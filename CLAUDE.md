- remember, never use emojis for buttons, use clean line art icons
- remember to always prompt user to apply sql fixes in the supabase web ui, don't try yourself
- remember The large database files (2GB+ SQLite files, XML metadata) were excluded from the commit as they're development artifacts that don't belong in
  version control. The essential code changes and smaller configuration files were successfully pushed.
- always work with this scraper: scripts/improved-clear-logo-scraper.ts never create a new one improve this one untill we have a working scraper
- LaunchBox provides daily database exports at:
  - https://gamesdb.launchbox-app.com/Metadata.zip (92MB, refreshed daily)
- remember this process to import clear logos, in the future when i ask you to import clear logos use this process
- remember to always start the logo proxy server in the background when starting/restarting the dev server
- always make sure that the logo proxy server is running