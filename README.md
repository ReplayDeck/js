# replaydeck

Records a page with [rrweb](https://github.com/rrweb-io/rrweb) and posts the events to your
collector in chunks. That's the whole job. The recording is the easy half; the work is getting
the events out reliably without hammering the ingest endpoint or losing the tail when someone
closes the tab.

## Install

```bash
npm i replaydeck
```

```js
import { init } from "replaydeck"

init({ key: "YOUR_SITE_KEY", host: "https://your-collector" })
```

No bundler, drop the snippet:

```html
<script src="https://unpkg.com/replaydeck/dist/replaydeck.global.js"></script>
<script>
  replaydeck.init({ key: "YOUR_SITE_KEY", host: "https://your-collector" })
</script>
```

Recording starts on `init`. Calling it twice is a no-op, so you don't have to guard it.

## API

```ts
const rd = init(config)

rd.getSessionId() // current session id
rd.isRecording()  // false if sampling dropped this session, or a bad key stopped it
rd.flush()        // Promise<void>, push buffered events now instead of waiting for the interval
rd.stop()
rd.start()
```

## Config

| Option | Default | |
|---|---|---|
| `key` | required | the site's ingest key |
| `host` | required | where `/ingest` lives |
| `maskAllInputs` | `true` | every input is masked out of the box; opt specific fields back in |
| `maskTextClass` | `rd-mask` | text inside elements with this class is masked |
| `blockClass` | `rd-block` | elements with this class aren't recorded at all |
| `sampleRate` | `1` | 0..1, rolled once per session so a reload doesn't flip the decision |
| `flushIntervalMs` | `5000` | clamped to a 1s floor, because the collector rate-limits ingest |
| `maxChunkBytes` | `900000` | a chunk is cut before this to stay under the 2MB body cap |
| `recordCanvas` | `false` | |
| `onError` | | called on a fatal misconfig (bad key/origin) or a dropped chunk |

## The parts that matter

**The key is public.** It ships in your bundle, so treat it that way. What keeps other sites
out is the Origin allowlist on the collector, not the key.

**One session per tab.** The session id and its chunk counter live in `sessionStorage`, so they
survive a reload and same-tab navigation, and two tabs record as two sessions. No cross-tab
coordination, which is one less thing to get wrong.

**Delivery is serial and in order.** Events get buffered, cut into chunks under the size and
count caps, and sent one at a time. A chunk keeps its `seq` and gets retried until the collector
takes it. The collector dedupes on `(sessionId, seq)`, so a retry after a flaky network is a
no-op, not a double write, and `seq` only moves forward on a `204`. That's what keeps the
sequence contiguous for replay.

**Unload is best-effort.** On `pagehide` and `visibilitychange`, whatever is still queued goes
out through `sendBeacon`. There are no acks there, but it's what catches the last few seconds
instead of dropping them on the floor.

**Sends skip the CORS preflight.** The body goes as `text/plain`, which keeps the request
CORS-simple, so there's no `OPTIONS` round trip on every flush. The collector decodes it as JSON
regardless of the content type.

**When the session is gone, it starts over.** A `409` or `410` means the collector no longer has
that session (a rotated key, or retention purged it), so the recorder mints a new one and takes a
fresh full snapshot as its first chunk. A `401` or `403` is a config problem, not a transient
one, so it stops recording and calls `onError` rather than retrying into nothing.
