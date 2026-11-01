# Six original course-specific racing loops

All six scores were composed for their respective course and synthesized offline without samples, source recordings, external songs, vocals or audio services. `generate_course_music.py` contains all notes, rhythms, arrangements and instruments.

| Course | File | BPM | Duration | Composition |
|---|---|---:|---:|---|
| 翡翠山谷 | music-valley.mp3 | 132 | 29.091 s | D major; Lively melodic electro; springy offbeat bass and a rising pentatonic hook |
| 赤岩峡谷 | music-canyon.mp3 | 138 | 27.826 s | D minor / Phrygian color; Percussive broken electro; 3+3+2 bass accents, hand-tom syncopation, low modal riff |
| 蔚蓝海岸 | music-coast.mp3 | 128 | 30.000 s | F major; Bright coastal house; syncopated chord chops, bouncy octave bass and an answering mallet melody |
| 极光雪岭 | music-snow.mp3 | 124 | 30.968 s | B minor; Airy progressive breaks; interlaced crystal arpeggios, suspended voicings and broad half-time snare |
| 霓虹夜城 | music-city.mp3 | 112 | 34.286 s | F# minor; Driving synthwave; straight eighth-note motor bass, warm analog chords and a long singing lead |
| 黑洞荒原 | music-alien.mp3 | 136 | 28.235 s | C minor; Dark space techno; asymmetric pulse ostinato, low dissonant textures and a sparse descending signal motif |

Each loop is exactly 16 bars / 64 beats at 48 kHz stereo, delivered as a 160 kbps MP3 plus a WAV intermediate. All note releases, pads, delays and room reflections are scheduled circularly into the final buffer. There is no end fade or silence gap. Use decoded AudioBuffer playback with loop=true. Gapless MP3 decoded sample counts exactly match the WAV.

WAV RMS is −15.30 dBFS for every track. Decoded MP3 RMS ranges −15.75 to −15.74 dBFS. Measured 4× decoded true peaks range −4.33 to −2.28 dBFS, leaving more than the required −1 dBFS headroom. The sample step across every loop boundary is below 0.007 full scale, smaller than normal interior waveform transitions. Every loop retains nonzero musical energy at both ends.

The tracks differ in harmony, melodic notes, rhythmic motifs, bass placement, drum foundation, instrument design and phrase development. Course IDs were checked against lib/courses.ts. Full per-file measurements, paths and composition notes are in music-manifest.json.

No listening tool was available; verification covers encoding, exact sample counts, signal levels, stereo output and loop boundaries.
