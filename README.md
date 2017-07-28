subtitles.js
============

Overview
--------

This project is a simple, somewhat lightweight, Javascript library for
displaying subtitles on `<video>` elements in a non-native fashion.

The intent is to allow the user to use
[Rikaichan](http://www.polarcloud.com/rikaichan) on [Japanese
subtitles](https://kitsunekko.net/dirlist.php?dir=subtitles%2Fjapanese%2F).
Because the user cannot interact with native subtitles and captions, they make
it hard to use translation tools. In contrast, `subtitles.js` parse the
subtitles files itself and simply display them as text over the playing video.

What works (included features)
------------------------------

* support of [`.srt`](https://en.wikipedia.org/wiki/SubRip) and
  [`.vtt`](https://en.wikipedia.org/wiki/WebVTT) subtitles
* selection of subtitle language among several available
* cues with multiple lines
* video navigation (pause/resume/seek/speed change)
* subtitle navigation (going to previous or next subtitle)
* the timings should be mostly accurate

What does not (missing features)
--------------------------------

* simultaneous subtitles for several languages (displaying several sources)
* overlapping cues (several cues on the screen)

Usage
-----

The library is included in the following manner:

```javascript
<script src="subtitles.js"></script>
```

It detects `<video>` elements and search for `<track>` with the `kind` property
set to `x-subtitles`. For instance:

```html
<video controls preload="metadata">
    <source src="video.webm" type="video/webm">
    <source src="video.mp4" type="video/mp4">
    <track kind="x-subtitle" label="Japanese" srclang="ja" src="video.ja.srt" default>
    <track kind="x-subtitle" label="English" srclang="en" src="video.en.srt">
</video>
```

In addition, you will probably want to stylize the elements used to display the
subtitles so that they actually show over the video. You may take a look at the
styles used in `index.php`, the included media navigator.
