# Deployment Guide for Sup Dinner App

## Prerequisites

- GitHub account
- Supabase project (already configured)
- Domain: supdinner.com (already configured)

## Step 1: Create GitHub Repository

1. Go to [GitHub](https://github.com) and sign in
2. Click the "+" icon in the top right corner
3. Select "New repository"
4. Repository name: `sup` (or `supdinner`)
5. Description: "Dinner table booking app - meet new people over dinner"
6. Make it **Public** (required for GitHub Pages)
7. **Don't** initialize with README, .gitignore, or license (we already have these)
8. Click "Create repository"

## Step 2: Connect Local Repository to GitHub

After creating the repository, GitHub will show you commands. Use these:

```bash
# Add the remote origin (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/sup.git

# Push your code to GitHub
git push -u origin main
```

## Step 3: Enable GitHub Pages

1. Go to your repository on GitHub
2. Click "Settings" tab
3. Scroll down to "Pages" section (left sidebar)
4. Under "Source", select "Deploy from a branch"
5. Select "main" branch (since frontend files are now in root)
6. Click "Save"

**Note**: We've simplified the deployment by placing the frontend files in the root directory. This means GitHub Pages can serve them directly without needing the gh-pages branch or GitHub Actions workflow.

## Step 4: Verify Supabase Configuration

Your app is already configured with Supabase credentials:
- URL: `https://ennlvlcogzowropkwbiu.supabase.co`
- Anon Key: Already configured in `frontend/script.js`

## Step 5: Deploy Supabase Edge Functions

1. Go to your Supabase project dashboard
2. Navigate to "Edge Functions"
3. Deploy each function from the `backend/supabase/functions/` folder:
   - `get-user-by-phone`
   - `join-table`
   - `join-waitlist`
   - `leave-table`
   - `leave-waitlist`
   - `signup-and-join`
   - `signup-and-waitlist`
   - `send-request-notification`
   - `send-signup-notification`
   - And all other functions

## Step 6: Set Up Database

1. In Supabase dashboard, go to "SQL Editor"
2. Copy and paste the contents of `backend/dump.sql`
3. Run the SQL commands to create tables, functions, and triggers

## Step 7: Configure Domain

1. In your domain registrar (where you bought supdinner.com):
   - Add a CNAME record pointing to `YOUR_USERNAME.github.io`
   - Or add an A record pointing to GitHub Pages IP addresses

2. In GitHub repository settings:
   - Go to "Pages" section
   - Add `supdinner.com` to the "Custom domain" field
   - Check "Enforce HTTPS"

## Step 8: Test Deployment

1. Wait a few minutes for GitHub Actions to deploy
2. Visit your domain: `https://supdinner.com`
3. Test the signup flow with a phone number
4. Verify tables are loading correctly

## Troubleshooting

### Tables Not Loading
- Check browser console for errors
- Verify Supabase URL and anon key are correct
- Ensure RLS policies are set up correctly
- Check that Edge Functions are deployed

### GitHub Pages Not Working
- Ensure repository is public
- Check GitHub Actions workflow is running
- Verify gh-pages branch was created
- Check domain configuration

### Supabase Functions Not Working
- Verify functions are deployed
- Check function logs in Supabase dashboard
- Ensure proper CORS configuration
- Verify function URLs in frontend code

## Next Steps

Once deployed and working:
1. Add your first dinner tables to the database
2. Test the complete user flow
3. Customize the design if needed
4. Add new features

## Support

If you encounter issues:
1. Check the browser console for errors
2. Review Supabase function logs
3. Check GitHub Actions workflow status
4. Verify all configuration steps were completed
