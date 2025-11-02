# Simple FFmpeg Testing Plan

## Goal

Verify WebM format works with OpenAI Whisper API, then test chunking, then integrate into code.

---

## Phase 1: Basic WebM Recording & Upload (5 seconds)

### Step 1: Record 5 seconds of audio

```bash
mkdir -p /tmp/speech-test
cd /tmp/speech-test

# Record 5 seconds
ffmpeg -f avfoundation -i ":default" \
  -c:a libopus -b:a 32k -application voip -ar 16000 -ac 1 \
  -t 5 \
  test.webm
```

**Verify**: File exists and has size > 0

```bash
ls -lh test.webm
```

### Step 2: Test WebM upload to OpenAI

```bash
# Using curl to test direct upload
curl https://api.openai.com/v1/audio/transcriptions \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: multipart/form-data" \
  -F file="@test.webm" \
  -F model="whisper-1"
```

**Expected**: JSON response with transcribed text
**If fails**: Try converting to MP3 first

### Step 3: If WebM fails, convert to MP3

```bash
ffmpeg -i test.webm -vn -ar 16000 -ac 1 -b:a 32k -f mp3 test.mp3

# Test MP3 upload
curl https://api.openai.com/v1/audio/transcriptions \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: multipart/form-data" \
  -F file="@test.mp3" \
  -F model="whisper-1"
```

**Decision Point**:

- ✅ If WebM works → use WebM directly
- ✅ If only MP3 works → keep conversion step

---

## Phase 2: Chunked Recording (3-second chunks)

### Step 1: Record with segmentation

```bash
cd /tmp/speech-test
rm -f chunk_*.webm  # Clean up

# Record 10 seconds in 3-second chunks
timeout 10 ffmpeg -f avfoundation -i ":default" \
  -c:a libopus -b:a 32k -application voip -ar 16000 -ac 1 \
  -f segment -segment_time 3 -reset_timestamps 1 \
  chunk_%03d.webm \
  2> ffmpeg.log
```

**Verify**: Multiple chunks created

```bash
ls -lh chunk_*.webm
```

### Step 2: Check FFmpeg stderr for events

```bash
# Look for chunk completion messages
grep -i "closing" ffmpeg.log
grep -i "segment.*ended" ffmpeg.log
```

**Record findings**:

- [ ] "Closing" messages present: YES/NO
- [ ] "segment ended" messages present: YES/NO
- [ ] Which message is more reliable: \***\*\_\_\_\*\***

### Step 3: Test chunk upload

```bash
# Test first chunk
curl https://api.openai.com/v1/audio/transcriptions \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: multipart/form-data" \
  -F file="@chunk_000.webm" \
  -F model="whisper-1"
```

**Verify**: Chunk transcribes successfully

---

## Phase 3: Real-time Chunk Detection

### Test: Monitor stderr in real-time

```bash
cd /tmp/speech-test
rm -f chunk_*.webm

# Run with real-time monitoring
ffmpeg -f avfoundation -i ":default" \
  -c:a libopus -b:a 32k -application voip -ar 16000 -ac 1 \
  -f segment -segment_time 3 -reset_timestamps 1 \
  chunk_%03d.webm \
  2>&1 | while read line; do
    echo "[$(date +%H:%M:%S)] $line"

    # Detect chunk ready
    if echo "$line" | grep -qi "closing.*chunk"; then
      CHUNK=$(echo "$line" | grep -oE "chunk_[0-9]{3}\.webm")
      echo ">>> CHUNK READY: $CHUNK"
    fi
  done
```

**Run for 10 seconds, then Ctrl+C**

**Record**:

- [ ] Chunks detected immediately after "Closing": YES/NO
- [ ] Any false positives: YES/NO
- [ ] Timing delay: \***\*\_\_\_\*\***

---

## Phase 4: Code Integration

Based on test results, update code:

### If WebM works directly:

- Remove MP3 conversion from AudioConverter
- Upload WebM directly to OpenAI

### If MP3 required:

- Keep AudioConverter as-is
- Convert chunks before upload

### ChunkProcessor updates:

```typescript
// Use the reliable detection pattern from Phase 2
if (text.includes("Closing '")) {
	const match = text.match(/Closing '([^']+)'/)
	if (match) {
		const chunkPath = match[1]
		this.emit("chunkReady", chunkPath)
	}
}
```

---

## Summary Checklist

After completing all phases:

- [ ] WebM format works: YES/NO
- [ ] MP3 conversion needed: YES/NO
- [ ] Reliable chunk detection pattern: \***\*\_\_\_\*\***
- [ ] Timing characteristics: \***\*\_\_\_\*\***
- [ ] Ready to integrate: YES/NO

## Next Steps

1. Run Phase 1 tests
2. Document results
3. Run Phase 2 tests
4. Document results
5. Run Phase 3 tests
6. Update code based on findings
7. Test integrated solution
