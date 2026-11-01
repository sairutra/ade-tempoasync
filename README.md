# TempoAsync

A MIDI sequencer where **every channel has its own tempo curve**. Instead of one global BPM, each
track is a line of BPM values over time: draw ramps, waves or terraces, and each channel's MIDI
loop speeds up and slows down along its line. The tracks drift apart and land back together, and the
**sync view** shows exactly when.

![The timeline: five tracks, each a BPM curve, with the playhead at bar 14](docs/images/timeline.png)

## How it works

The browser is the editor; the Node server plays the MIDI. The client owns the state, sends a snapshot
when it connects and then streams only the edits over a WebSocket. The server keeps one channel per
track and schedules its notes ahead of time with MIDI timestamps.

```mermaid
flowchart LR
    subgraph Browser["client/ (React + Vite)"]
        UI["Timeline editor<br/>drag nodes, add channels,<br/>edit sequences"] --> Model["Timeline model<br/>bpms[] per track"]
        Model --> Diff["sync/diff<br/>minimal patches"]
    end
    Diff -- "WebSocket /ws<br/>snapshot · addTrack · patch<br/>sequence · start · stop" --> WS
    subgraph Server["server/ (Express + ws)"]
        WS["wsServer"] --> Ch["Channel per track<br/>bpms + MIDI sequence"]
        Ch --> SP["SequencePlayer<br/>absolute timeline,<br/>25 ms lookahead"]
    end
    SP -- "note on / off<br/>with timestamps" --> MIDI(("MIDI out<br/>synth / DAW"))
```

## Features

### Tracks are tempo curves

Each track stores one BPM per 16th-note step. Every step lasts `60 / bpm / 4` seconds at its own BPM,
so the same 16-step loop plays faster where the line is high and slower where it is low.

```mermaid
xychart-beta
    title "One track's tempo (BPM per bar)"
    x-axis "bar" [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
    y-axis "BPM" 60 --> 160
    line [120, 120, 120, 120, 120, 120, 120, 120, 130, 140, 140, 140]
    line [100, 115, 100, 85, 100, 115, 100, 85, 100, 115, 100, 85]
```

Drag a node to reshape the line; points between two nodes follow the straight line between them.
Edits during playback reach the server as small patches and apply from the next step it schedules.

### Sync view

**X: steps** draws step *i* of every track at the same x. **X: time** draws each step at the real time
it sounds, with a tick on every beat of the line. Downbeats that land on a bar line of the project
tempo light up green, so you can see where the tracks line up again.

![Sync view: lines drawn in real time, green ticks where a track's bar lands on a project bar](docs/images/sync-view.png)

```mermaid
gantt
    title Beats in the first 2 seconds at three tempos (ms)
    dateFormat x
    axisFormat %L
    section 120 BPM (project)
    beat 1 :0, 500
    beat 2 :500, 1000
    beat 3 :1000, 1500
    beat 4 :1500, 2000
    section 160 BPM
    beat 1 :0, 375
    beat 2 :375, 750
    beat 3 :750, 1125
    beat 4 :1125, 1500
    section 80 BPM
    beat 1 :0, 750
    beat 2 :750, 1500
```

### Generated patterns that stay in sync

**+ Add** opens a dialog with a straight line or a generated pattern: a **wave** (sine, triangle,
saw, pulse), **random** values, or a **split period** (part of each period at one BPM, the rest at
whatever keeps time). With *keep in sync* on, every window lasts exactly as long as at the sync BPM,
because the window's harmonic-mean BPM equals the sync BPM. The line wanders, but the downbeats come
back on the grid.

<p>
  <img src="docs/images/add-channel.png" alt="Add channel dialog generating a sine pattern in sync with 120 BPM" width="360">
  <img src="docs/images/edit-track.png" alt="Edit channel dialog with a 16-step MIDI sequence" width="300">
</p>

### MIDI sequence per channel

Each track has a MIDI channel (1–16) and a looping sequence of up to 16 steps: a note from 0–127, or
`-1` for a rest. Edit it from the ✎ button next to the track name.

### Timeline editing

- Ctrl/Cmd + wheel or pinch to zoom time; Alt + wheel to stretch the BPM axis; **Fit** shows everything
- Edit the BPM range with the inputs at the top and bottom of the axis
- Space plays and pauses; click or drag the ruler to move the playhead

## Getting started

You need Node.js and a MIDI output: a hardware synth, a DAW, or a virtual MIDI port.

```sh
# backend: Express + WebSocket + MIDI, http://localhost:3000
cd server && npm install && npm start

# frontend: Vite dev server, http://localhost:5173 (proxies /ws to the backend)
cd client && npm install && npm run dev
```

Tests: `npm test` in `client/` (Vitest) and in `server/` (node:test).
[`client/README.md`](client/README.md) covers the timeline architecture in depth.
