import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");

const CF_HANDLE = process.env.CF_HANDLE || "Code_Tushar";
const LC_HANDLE = process.env.LC_HANDLE || "Code_Tushar";
const CC_HANDLE = process.env.CC_HANDLE || "code_tushr";

// Default fallback values matching current verified live stats
const fallbackStats = {
  leetcode: {
    totalSolved: 137,
    easySolved: 90,
    mediumSolved: 46,
    hardSolved: 1,
    ranking: 1279933,
  },
  codeforces: {
    rating: 1154,
    maxRating: 1205,
    rank: "newbie",
    maxRank: "pupil",
    solvedCount: 127,
  },
  codechef: {
    rating: 1420,
    highestRating: 1420,
    stars: "2★",
    division: "Div 2",
    globalRank: 39847,
  },
};

/**
 * Fetch Codeforces stats: User profile info + distinct AC problem count
 */
async function fetchCodeforces(handle) {
  const result = { ...fallbackStats.codeforces };
  try {
    const [infoRes, statusRes] = await Promise.allSettled([
      fetch(`https://codeforces.com/api/user.info?handles=${encodeURIComponent(handle)}`, {
        headers: { "User-Agent": "Mozilla/5.0 GitHub-Profile-Sync/1.0" },
      }),
      fetch(`https://codeforces.com/api/user.status?handle=${encodeURIComponent(handle)}`, {
        headers: { "User-Agent": "Mozilla/5.0 GitHub-Profile-Sync/1.0" },
      }),
    ]);

    if (infoRes.status === "fulfilled" && infoRes.value.ok) {
      const data = await infoRes.value.json();
      if (data.status === "OK" && data.result?.[0]) {
        const u = data.result[0];
        result.rating = u.rating || result.rating;
        result.maxRating = u.maxRating || result.maxRating;
        result.rank = u.rank || result.rank;
        result.maxRank = u.maxRank || result.maxRank;
      }
    }

    if (statusRes.status === "fulfilled" && statusRes.value.ok) {
      const data = await statusRes.value.json();
      if (data.status === "OK" && Array.isArray(data.result)) {
        const solved = new Set();
        for (const sub of data.result) {
          if (sub.verdict === "OK" && sub.problem) {
            const key = `${sub.problem.contestId || 0}_${sub.problem.index || ""}`;
            solved.add(key);
          }
        }
        if (solved.size > 0) {
          result.solvedCount = solved.size;
        }
      }
    }
  } catch (err) {
    console.warn("[CF Sync Warning] Using fallback:", err.message);
  }
  return result;
}

/**
 * Fetch LeetCode stats via GraphQL with Alfa-LeetCode fallback
 */
async function fetchLeetCode(handle) {
  const result = { ...fallbackStats.leetcode };
  try {
    const gqlRes = await fetch("https://leetcode.com/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Referer: "https://leetcode.com",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      body: JSON.stringify({
        query: `
          query getUserProfile($username: String!) {
            matchedUser(username: $username) {
              profile {
                ranking
              }
              submitStatsGlobal {
                acSubmissionNum {
                  difficulty
                  count
                }
              }
            }
          }
        `,
        variables: { username: handle },
      }),
    });

    if (gqlRes.ok) {
      const json = await gqlRes.json();
      const user = json?.data?.matchedUser;
      if (user) {
        result.ranking = user.profile?.ranking || result.ranking;
        const stats = user.submitStatsGlobal?.acSubmissionNum;
        if (Array.isArray(stats)) {
          for (const item of stats) {
            if (item.difficulty === "All") result.totalSolved = item.count;
            if (item.difficulty === "Easy") result.easySolved = item.count;
            if (item.difficulty === "Medium") result.mediumSolved = item.count;
            if (item.difficulty === "Hard") result.hardSolved = item.count;
          }
          return result;
        }
      }
    }
  } catch (err) {
    console.warn("[LC GraphQL Warning] Trying secondary endpoint:", err.message);
  }

  // Secondary fallback for LeetCode
  try {
    const fallbackRes = await fetch(
      `https://alfa-leetcode-api.onrender.com/userProfile/${encodeURIComponent(handle)}`
    );
    if (fallbackRes.ok) {
      const fbData = await fallbackRes.json();
      if (fbData && fbData.totalSolved !== undefined) {
        result.totalSolved = fbData.totalSolved;
        result.easySolved = fbData.easySolved ?? result.easySolved;
        result.mediumSolved = fbData.mediumSolved ?? result.mediumSolved;
        result.hardSolved = fbData.hardSolved ?? result.hardSolved;
        result.ranking = fbData.ranking ?? result.ranking;
      }
    }
  } catch (err) {
    console.warn("[LC Fallback Warning] Using default LC stats:", err.message);
  }

  return result;
}

/**
 * Fetch CodeChef stats via public API
 */
async function fetchCodeChef(handle) {
  const result = { ...fallbackStats.codechef };
  try {
    const res = await fetch(`https://codechef-api-gamma.vercel.app/${encodeURIComponent(handle)}`, {
      headers: { "User-Agent": "Mozilla/5.0 GitHub-Profile-Sync/1.0" },
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.success) {
        result.rating = data.currentRating || result.rating;
        result.highestRating = data.highestRating || result.highestRating;
        result.stars = data.stars || result.stars;
        result.globalRank = data.globalRank || result.globalRank;
        if (result.rating >= 1400) {
          result.division = "Div 2";
        } else if (result.rating >= 1000) {
          result.division = "Div 3";
        } else {
          result.division = "Div 4";
        }
      }
    }
  } catch (err) {
    console.warn("[CC Sync Warning] Using fallback:", err.message);
  }
  return result;
}

/**
 * Generate Visual Markdown Stats Block
 */
function generateStatsMarkdown(lc, cf, cc) {
  const totalSolved = lc.totalSolved + cf.solvedCount + 45;
  const dateStr = new Date().toUTCString();

  const lcBlocks = Math.min(35, Math.max(1, Math.round((lc.totalSolved / 250) * 35)));
  const cfBlocks = Math.min(35, Math.max(1, Math.round((cf.solvedCount / 250) * 35)));
  const ccBlocks = Math.min(35, Math.max(1, Math.round((cc.rating / 2000) * 35)));

  const lcBar = "█".repeat(lcBlocks) + "░".repeat(Math.max(0, 35 - lcBlocks));
  const cfBar = "█".repeat(cfBlocks) + "░".repeat(Math.max(0, 35 - cfBlocks));
  const ccBar = "█".repeat(ccBlocks) + "░".repeat(Math.max(0, 35 - ccBlocks));

  return `<!-- CP_STATS_START -->
<div align="center">

| 🏆 **Platform** | 👤 **Handle** | 📊 **Live Rating / Rank** | 🎯 **Problems Solved** | 🔗 **Profile Link** |
| :--- | :--- | :--- | :--- | :--- |
| <img src="https://cdn.simpleicons.org/leetcode/FFA116" width="18" height="18" alt="LeetCode" /> **LeetCode** | [\`@${LC_HANDLE}\`](https://leetcode.com/u/${LC_HANDLE}/) | **Global #${lc.ranking.toLocaleString()}** | **${lc.totalSolved} Solved** <br/> 🟢 ${lc.easySolved} Easy &bull; 🟡 ${lc.mediumSolved} Med &bull; 🔴 ${lc.hardSolved} Hard | [Visit Profile ↗](https://leetcode.com/u/${LC_HANDLE}/) |
| <img src="https://cdn.simpleicons.org/codeforces/1F8ACB" width="18" height="18" alt="Codeforces" /> **Codeforces** | [\`@${CF_HANDLE}\`](https://codeforces.com/profile/${CF_HANDLE}) | **${cf.rating}** (Max ${cf.maxRating}) <br/> \`${cf.rank.toUpperCase()}\` | **${cf.solvedCount} Problems** (Distinct Solved) | [Visit Profile ↗](https://codeforces.com/profile/${CF_HANDLE}) |
| <img src="https://cdn.simpleicons.org/codechef/5B4638" width="18" height="18" alt="CodeChef" /> **CodeChef** | [\`@${CC_HANDLE}\`](https://www.codechef.com/users/${CC_HANDLE}) | **${cc.rating}** (${cc.stars}) <br/> \`${cc.division}\` &bull; #${cc.globalRank.toLocaleString()} Global | **45+ Problems** (Contest Contender) | [Visit Profile ↗](https://www.codechef.com/users/${CC_HANDLE}) |

### 📈 Aggregate Problem Solving Progress: **${totalSolved}+ Problems**
\`\`\`text
LeetCode Solved   : [${lcBar}] ${lc.totalSolved} Solved (${lc.easySolved} Easy / ${lc.mediumSolved} Med / ${lc.hardSolved} Hard)
Codeforces Solved : [${cfBar}] ${cf.solvedCount} Solved (Rating: ${cf.rating} / Max: ${cf.maxRating})
CodeChef Progress : [${ccBar}] ${cc.rating} Rating (${cc.stars} • ${cc.division})
\`\`\`

<p align="center">
  <img src="https://img.shields.io/badge/Total%20DSA%20Solved-${totalSolved}%2B-22c55e?style=for-the-badge&logo=codeforces&logoColor=white" alt="Total Solved" />
  <img src="https://img.shields.io/badge/LeetCode-${lc.totalSolved}%20Solved-FFA116?style=for-the-badge&logo=leetcode&logoColor=black" alt="LeetCode Badge" />
  <img src="https://img.shields.io/badge/Codeforces-${encodeURIComponent(`${cf.rating} (${cf.rank})`)}-1f8acb?style=for-the-badge&logo=codeforces&logoColor=white" alt="Codeforces Badge" />
  <img src="https://img.shields.io/badge/CodeChef-${encodeURIComponent(`${cc.rating} (${cc.stars})`)}-5B4638?style=for-the-badge&logo=codechef&logoColor=white" alt="CodeChef Badge" />
</p>

<sub>🔄 <i>Auto-synchronized by GitHub Actions &bull; Last updated: ${dateStr}</i></sub>
</div>
<!-- CP_STATS_END -->`;
}

/**
 * Main update function
 */
async function main() {
  console.log("⚡ Fetching live CP stats for Tushar Choudhary...");
  console.log(`Handles: CF: @${CF_HANDLE} | LC: @${LC_HANDLE} | CC: @${CC_HANDLE}`);

  const [cf, lc, cc] = await Promise.all([
    fetchCodeforces(CF_HANDLE),
    fetchLeetCode(LC_HANDLE),
    fetchCodeChef(CC_HANDLE),
  ]);

  const total = lc.totalSolved + cf.solvedCount + 45;

  console.log("✅ Results fetched:");
  console.log(`- Codeforces: Rating ${cf.rating} (Max ${cf.maxRating}), ${cf.solvedCount} solved, Rank: ${cf.rank}`);
  console.log(`- LeetCode  : ${lc.totalSolved} solved (${lc.easySolved}E / ${lc.mediumSolved}M / ${lc.hardSolved}H), Rank: #${lc.ranking}`);
  console.log(`- CodeChef  : Rating ${cc.rating} (${cc.stars}), ${cc.division}, Rank: #${cc.globalRank}`);
  console.log(`- Total Solved: ${total}+`);

  const newStatsBlock = generateStatsMarkdown(lc, cf, cc);

  const targetFile = path.join(ROOT_DIR, "README.md");
  try {
    const content = await fs.readFile(targetFile, "utf-8");
    const regex = /<!-- CP_STATS_START -->[\s\S]*?<!-- CP_STATS_END -->/;
    if (regex.test(content)) {
      const updatedContent = content.replace(regex, newStatsBlock);
      await fs.writeFile(targetFile, updatedContent, "utf-8");
      console.log(`✨ Successfully updated stats in ${targetFile}`);
    } else {
      console.log(`ℹ️ Marker tags not found in ${targetFile}; skipped injection.`);
    }
  } catch (err) {
    console.error(`Error updating ${targetFile}:`, err);
  }
}

main().catch((err) => {
  console.error("Fatal error during stats update:", err);
  process.exit(1);
});
