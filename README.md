# melodia

**One planet. Infinite vibes.**

Somewhere in the world, a song is playing for someone you've never met. A voice, a rhythm, a moment that belongs to a place—and can reach beyond it.

Melodia was born from the idea that music can make the world feel closer. Not as a collection of borders or distances, but as countless lives unfolding at once, each with its own sound.

Turn toward somewhere unfamiliar. Stay for the music. Feel the distance disappear for a moment.

**The world has a rhythm. What's yours?**

## Catalogue updates

`npm run compact:stations` reduces the existing snapshot without downloading it again. It removes duplicate stream URLs, empty fields, zero defaults and per-station check timestamps, while retaining distinct original/resolved URLs for exclusions and fallback playback. Each record is checked for equivalent normalized playback data before replacement. New downloads use the same compact representation. This is JSON size reduction, not HTTP compression.

Run `npm run update:stations -- --dry-run` to download and validate a candidate without changing the bundled catalogue. Run `npm run update:stations` to replace it locally after validation, then review the diff and run `npm run test:catalogue` and `npm run test:pages` before committing and deploying. Reports are written to `reports/stations-update.json`, outside the published site. `ready` means the candidate passed validation, not that it was deployed.

The updater scans one Radio Browser mirror at a time with pagination, restarting from zero on mirror failure. It requires `lastcheckok=1`, applies the existing HTTPS/name/UUID validation and permanent exclusions, deduplicates UUIDs, and retains HLS and stations without coordinates (browser capabilities and globe placement are handled at runtime). It does not contact audio streams or verify broadcast permissions. Older snapshots without health metadata remain loadable; an explicit failed check is rejected on all runtime paths.

An empty result, malformed response, pagination failure or a drop of more than 20% stops replacement. The previous file is retained on failure; the new file is staged beside it before renaming. Review unexpected declines rather than bypassing the guard. The report records counts, additions/removals, timestamps and source. API pagination is not a transactional snapshot, so counts may vary while the directory changes.

The manual **Prepare station catalogue update** Actions workflow runs checks and uploads a candidate and report for review, without committing or deploying them. Download the candidate, review and commit it to publish through the usual Pages workflow. No daily schedule is enabled until the first candidate has been reviewed and tested in the browser. Pages also applies permanent exclusions before publishing. A scheduled workflow by itself would not persist an updated catalogue; that publishing step remains to be enabled after review.

## Handling station removals

Melodia plays station streams directly in the listener's browser; it does not proxy or archive audio. Radio Browser supplies directory data, not permission for every broadcast.

To exclude a station after a report, add its `stationuuid` to `excludedStationIds` in `public/station-exclusions.js`, run `npm run prune:stations`, `npm run check` and `npm test`, then deploy. If a broadcaster requests removal of every stream on a host, add the host to `excludedStreamHosts` instead (this also excludes its subdomains). Check the scope first: shared CDN hosts can serve unrelated broadcasters. Both the live API and bundled snapshot are filtered at runtime, including shared links and favorites. Pruning removes matching raw records from the publicly accessible `public/assets/stations.json`; do the same whenever the snapshot is regenerated. Do not add personal contact details or private correspondence to the public repository.

For an urgent report, disable the relevant station in the published exclusions file immediately, then investigate the supporting information and document the outcome privately. A working stream, HTTPS, or a Radio Browser entry is not evidence of broadcast permissions.

Station reports use the contact email `evangelion.conquest@gmail.com` on `public/broadcasters.html`. The `mailto:` link opens the visitor's email app; Melodia does not send messages or forward report contents to a form service. Check this mailbox regularly, including its spam folder, and verify the contact address with a test message.
