#!/bin/bash
set -e  # Exit on any error

# ==== CONFIG ====
REPO_PATH="$HOME/Documents/yuyu-lounge"
BUCKET_NAME="yuyu-clips"
ACCOUNT_ID="576a70eea34e79fd1da058240d9a3d7a"
PROFILE="r2"
CLIPS_DIR="clips_r2"
URL_FILE="urls.txt"
PUBLIC_BUCKET_URL="https://pub-79f5b26eb4964851858b0213a591d17e.r2.dev"
MAIN_BRANCH="main"
DEPLOY_BRANCH="gh-pages"
# ================

cd "$REPO_PATH"

# 1. Ensure clips folder exists
mkdir -p "$CLIPS_DIR"

# 2. Download videos
echo "=== Downloading videos from $URL_FILE ==="
yt-dlp -f mp4 -o "$CLIPS_DIR/%(id)s.%(ext)s" -a "$URL_FILE"

# 3. Upload to R2
echo "=== Uploading to R2 bucket $BUCKET_NAME ==="
aws s3 cp "$CLIPS_DIR/" s3://$BUCKET_NAME/ \
  --endpoint-url "https://$ACCOUNT_ID.r2.cloudflarestorage.com" \
  --recursive --profile $PROFILE

# 4. Generate clips.json
echo "=== Generating public/clips.json ==="
mkdir -p public
echo "[" > public/clips.json
FIRST=true
for f in "$CLIPS_DIR"/*.mp4; do
  URL="$PUBLIC_BUCKET_URL/$(basename "$f")"
  if [ "$FIRST" = true ]; then
    FIRST=false
  else
    echo "," >> public/clips.json
  fi
  echo "  \"$URL\"" >> public/clips.json
done
echo "]" >> public/clips.json

# 5. Build site
echo "=== Building site ==="
npm ci || npm i
npm run build

# 6. Deploy to GitHub Pages (force clean)
echo "=== Deploying to GitHub Pages ==="
git fetch origin
git branch -D $DEPLOY_BRANCH 2>/dev/null || true
git checkout --orphan $DEPLOY_BRANCH
git reset --hard
cp -R dist/* .
git add -A
git commit -m "Update clips feed"
git push -f origin $DEPLOY_BRANCH
git checkout $MAIN_BRANCH

echo "=== Done! Site is live with updated clips ==="
