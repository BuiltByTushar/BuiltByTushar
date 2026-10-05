# 🚀 GitHub Profile Setup Guide for @BuiltByTushar

To activate your **live-updating GitHub Profile README** on `https://github.com/BuiltByTushar`:

### Step 1: Create Your Profile Repository on GitHub
1. Go to [https://github.com/new](https://github.com/new).
2. Set **Repository name** to exactly: `BuiltByTushar` (matching your username).
3. Ensure it is set to **Public**.
4. Leave "Add a README file" unchecked (you already have this folder ready).
5. Click **Create repository**.

### Step 2: Push this `profile-readme` folder
From your local terminal, navigate to this `profile-readme` folder and push:

```bash
cd profile-readme
git init -b main
git remote add origin https://github.com/BuiltByTushar/BuiltByTushar.git
git add .
git commit -m "feat: initialize dynamic profile README & live CP sync"
git push -u origin main
```

### Step 3: Enable GitHub Actions Workflow Permissions
1. In your `BuiltByTushar/BuiltByTushar` repository on GitHub:
2. Go to **Settings** → **Actions** → **General**.
3. Under **Workflow permissions**, select **"Read and write permissions"** and check **"Allow GitHub Actions to create and approve pull requests"**.
4. Click **Save**.

### 🌟 That's it!
Your profile at `https://github.com/BuiltByTushar` will now display:
- Live typing headline SVG
- Live-updating CP ratings and problem counts for LeetCode, Codeforces, and CodeChef
- ASCII progress bars and shields
- University coursework tree for MMMUT B.Tech CSE
- Hackathon & experience highlights (SIH Team Code4India)
- Verified Google Cloud Credly skill badges & Kaggle certificate
- GitHub metrics & streak cards
- Categorized technology stack
