# ThoughtWorks Radar — Complete Cumulative Archive

This project provides a comprehensive, interactive, and cumulative visualization of all 1,938 unique technologies spanning all 34 volumes (2010–2026) and 4 quadrants of the [ThoughtWorks Technology Radar](https://www.thoughtworks.com/radar).

👉 **[View the Live Interactive Radar Here](https://loginov-kirill.github.io/thoughtworks-radar-history/)**

## Features

- **Cumulative View**: Unlike the standard radar which only shows a snapshot of a single volume, this visualization carries over every technology from past volumes. An item stays in its last assigned ring until the radar explicitly moves or drops it.
- **Time Travel**: Use the slider to scrub backwards and forwards through 16 years of software engineering history.
- **Local Bookmarking**: Categorize technologies to build your own learning path! 
  - **✓ Known** (Green)
  - **★ To Learn** (Orange)
  - **⛔ Not Interesting** (Grey)
- **Filters**: Quickly filter the radar to only show the technologies you've bookmarked, or hide the ones you aren't interested in.
- *(Note: Your bookmarks are saved privately in your own browser's local storage).*

## Lightning-Fast Keyboard Shortcuts

Hover your mouse over any technology chip (or click it to open details) and use your keyboard to quickly categorize it:

- **`1`** or **`K`** — Mark as **Known**
- **`2`** or **`L`** — Mark as **To Learn**
- **`3`** or **`I`** — Mark as **Not Interesting**
- **`0`**, **`C`**, or **`Backspace`** — **Clear Mark**

## Development

If you'd like to rebuild the HTML file to pull in the latest ThoughtWorks data, simply run the included Node.js script:

```bash
node build_full_radar.js
```
This script downloads all historical JSON data directly from ThoughtWorks and generates a standalone `index.html` file.
