# Commands to Push Backend to GitHub

## Step 1: Navigate to backend-deploy folder
```bash
cd backend-deploy
```

## Step 2: Check current git status
```bash
git status
```

## Step 3: Add all changes
```bash
git add .
```

## Step 4: Commit changes
```bash
git commit -m "Fix email notifications: Send emails for all payment methods and fix status update emails"
```

## Step 5: Check remote repository
```bash
git remote -v
```

## Step 6: If remote is not set, add it
```bash
git remote add origin https://github.com/Ratan7408/anime_india_backened.git
```

## Step 7: Push to GitHub
```bash
git push -u origin main
```

# OR if you're on a different branch:
```bash
git push -u origin <your-branch-name>
```

## If you get authentication errors:
- Use Personal Access Token instead of password
- Or set up SSH keys

## Quick One-Liner (if already set up):
```bash
cd backend-deploy && git add . && git commit -m "Fix email notifications for all payment methods" && git push origin main
```



