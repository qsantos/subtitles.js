(function(){"use strict";

function $(selector, context) {
    /* Return first descendant of `context` matching the given `selector` */
    context = context || document;
    if (!context.querySelector) {
        return undefined;
    }
    return context.querySelector(selector);
}

function $$(selector, context) {
    /* Return descendant of `context` matching the given `selector` */
    // <http://libux.co/useful-function-making-queryselectorall-like-jquery/>
    context = context || document;
    if (!context.querySelectorAll) {
        return [];
    }
    let elements = context.querySelectorAll(selector);
    return Array.prototype.slice.call(elements);
}

function insertAfter(newNode, referenceNode) {
    referenceNode.parentNode.insertBefore(newNode, referenceNode.nextSibling);
}

function get_current_subtitle(subtitles, time) {
    if (!subtitles) {
        return [null, null, null];
    }

    // bisect for last subtitle whose start is before `time`, or first subtitle
    let a = 0;
    let b = subtitles.length;
    while (b - a > 1) {
        let m = a + parseInt((b - a) / 2);
        if (time < subtitles[m].start) {
            b = m;
        } else {
            a = m;
        }
    }

    // select adequate subtitles
    let previous, current, next;
    if (time < subtitles[a].start) {
        // special case when we are before the first subtitle
        previous = null;
        current = null;
        next = subtitles[a];
    } else if (subtitles[a].start <= time && time <= subtitles[a].stop) {
        previous = subtitles[a-1] || null;
        current = subtitles[a];
        next = subtitles[a+1] || null;
    } else {
        previous = subtitles[a] || null;
        current = null;
        next = subtitles[a+1] || null;
    }
    return [previous, current, next];
}

function create_subtitle_context(video) {
    /* Create DOM element to show subtitles */

    // the element that contains the actual subtitle (centerable inline-block)
    let subtitle_inner = document.createElement('div');
    subtitle_inner.classList.add('subtitle-inner');
    // container element for easy centering of the subtitles (block)
    let subtitle_outer = document.createElement('div');
    subtitle_outer.classList.add('subtitle-outer');
    subtitle_outer.appendChild(subtitle_inner);

    // the video and the subtitle container are put in a common div
    // video_container for easy positionning of the subtitles
    let video_container = document.createElement('div');
    video_container.classList.add('video-container');
    // move the video inside container while keeping the same position
    insertAfter(video_container, video);
    video_container.appendChild(video);
    video_container.appendChild(subtitle_outer);

    let context = {
        'video': video,
        'tracks': null,
        'current_track_index': 0,
        'subtitles': null,
        'video_container': video_container,
    };
    /* Function that actually changes the subtitles */
    context.update_subtitle = function() {
        /* Update the displayed subtitle; return the time of next change */
        var [previous, current, next] =
            get_current_subtitle(context.subtitles, video.currentTime);
        if (current) {
            subtitle_inner.innerHTML = current.text;
            return current.stop;
        }
        subtitle_inner.innerHTML = '';
        if (next) {
            return next.start;
        }
        return null;
    }

    /* The update loop updates subtitles automatically; it must be restarted
     * whenever playing changes (start/resume/change speed/seek); it is safe to
     * call it several times*/
    let loop_timer;
    function update_loop() {
        clearTimeout(loop_timer);  // make sure no other loop is running
        let next_change = context.update_subtitle();
        if (context.video.paused || next_change === null) {
            return;
        }
        // program next update
        let eta = (next_change - video.currentTime) / video.playbackRate;
        loop_timer = setTimeout(update_loop, eta * 1000);
    }
    video.addEventListener('playing', update_loop);
    video.addEventListener('ratechange', update_loop);
    video.addEventListener('seeked', update_loop);

    return context;
}

function ParsingError(message) {
    this.message = message;
    this.toString = function() {
        return String(this.constructor.name + ': ' + this.message)
    };
}

function parse_time(string) {
    /* Parse a time from format HH:MM:SS,mmm into seconds */
    let parts = string.split(/[:,\.]/);
    let [hours, minutes, seconds, milliseconds] = [0, 0, 0, 0];
    if (parts.length < 3) {
        throw new ParsingError('invalid timing "' + string + '"');
    } else if (parts.length < 4) {
        [minutes, seconds, milliseconds] = parts;
    } else {
        [hours, minutes, seconds, milliseconds] = parts;
    }
    return +hours*3600 + +minutes*60 + +seconds + +milliseconds/1000;
}

function parse_srt(raw_data) {
    // based on WebVTT without header <https://w3c.github.io/webvtt/>
    let blocks = raw_data.split(/(?:\r?\n){2,}/);
    let cues = Array();
    for (let i = 0; i < blocks.length; i += 1) {
        let block = blocks[i];
        if (!block.trim()) {
            continue;
        }

        // line 1 is timing information (HH:MM:SS,MMM --> HH:MM:SS,MMM)
        // rest is actual subtitle
        let lines = block.split(/\r?\n/);

        // locate the cue timings
        let timing_line;
        if (lines[0].match(/-->/)) {
            timing_line = 0;
        } else {
            timing_line = 1;
        }
        if (!lines[timing_line] || !lines[timing_line].match(/-->/)) {
            console.warn('invalid cue (continuing previous one?): ', block);
            cues[cues.length-1].text += '<br>' + lines.join('<br>');
            continue;
        }

        // extract cue timing information
        let parts = lines[timing_line].split(/[ \t]/);
        let start = parse_time(parts[0]);
        if (parts[1] != '-->') {
            console.warn('invalid cue: ', block);
            continue;
        }
        let stop = parse_time(parts[2]);

        // extract cue payload text
        let text = lines.slice(timing_line + 1).join('<br>');

        cues.push({start: start, stop: stop, text: text});
    }
    cues.sort(function(a, b) { return a.start - b.start; });
    return cues;
}

function parse_vtt(raw_data) {
    // strip the header and pass the rest to parse_srt
    let prefix = /^WEBVTT[^\r\n]*(?:\r?\n){1,}/.exec(raw_data);
    return parse_srt(raw_data.substring(prefix[0].length));
}

function parse_subtitles(raw_data, hint) {
    // hint should end in 'srt' or 'vtt', etc
    if (hint.endsWith('srt')) {
        return parse_srt(raw_data);
    } else if (hint.endsWith('vtt')) {
        return parse_vtt(raw_data);
    } else {
        throw new ParsingError('unsupported format');
    }
    return null;
}

function set_subtitles_track(context, track_index) {
    track_index %= context.tracks.length;
    context.current_track_index = track_index;
    localStorage.setItem('track-' + location.pathname, track_index);

    const track = context.tracks[track_index];
    const filename = track.src;

    let xhr = new XMLHttpRequest();
    xhr.open("GET", filename);
    xhr.onreadystatechange = function() {
        if (xhr.readyState != 4) {
            return;
        }

        if (xhr.status != 200 && xhr.status != 0) {
            console.log('Failed to load subtitles file "' + filename + '"');
            return;
        }

        context.subtitles = parse_subtitles(xhr.responseText, filename);;
        context.update_subtitle();
    }
    xhr.send(null);
}

function disable_subtitles(context) {
    context.subtitles = null;
    context.update_subtitle(context);
    context.current_track_index = -1;
}

function set_subtitles_track_default(context) {
    if (!context.tracks) {
        return;
    }

    let saved_track = localStorage.getItem('track-' + location.pathname);
    if (saved_track !== null) {
        set_subtitles_track(context, saved_track);
        return;
    }

    for (let i = 0; i < context.tracks.length; i += 1) {
        const track = context.tracks[i];
        if (track.default) {
            set_subtitles_track(context, i);
            return;
        }
    }
    set_subtitles_track(context, 0);
}

function cycle_subtitles_track(context) {
    set_subtitles_track(context, context.current_track_index + 1);
}

function jump_to_previous_subtitle(context) {
    if (!context.subtitles) {
        return;
    }
    var [previous, current, next] =
        get_current_subtitle(context.subtitles, context.video.currentTime);
    if (previous) {
        context.video.currentTime = previous.start + 1e-9;
    } else {
        context.video.currentTime = 0;
    }
    context.update_subtitle(context);
}

function jump_to_next_subtitle(context) {
    if (!context.subtitles) {
        return;
    }
    var [previous, current, next] =
        get_current_subtitle(context.subtitles, context.video.currentTime);
    if (next) {
        context.video.currentTime = next.start + 1e-9;
        context.update_subtitle(context);
    }
}

function create_subtitles_selector(context) {
    /* When there are alternative subtitles, display a selector */
    let tracks = $$('track[kind=x-subtitles]', context.video);
    context.tracks = tracks;
    if (tracks.length == 0) {
        return;
    }
    let ul = document.createElement('ul');
    ul.classList.add('subtitle-selector');
    // option to disable subtitles
    {
        let li = document.createElement('li');
        li.classList.add('subtitle-option');
        li.innerText = 'None';
        li.addEventListener('click', function() {
            context.subtitles = null;
            context.update_subtitle(context);
        });
        ul.appendChild(li);
    }
    // available subtitles
    for (let i = 0; i < tracks.length; i += 1) {
        let track = tracks[i];
        let li = document.createElement('li');
        li.classList.add('subtitle-option');
        li.innerText = track.label;
        li.addEventListener('click', function() {
            set_subtitles_track(context, i);
        });
        ul.appendChild(li);
    }
    context.video_container.appendChild(ul);
}

function create_subtitles_navigator(context) {
    let ul = document.createElement('ul');
    ul.classList.add('subtitle-navigator');

    let li_previous = document.createElement('li');
    li_previous.classList.add('subtitle-previous');
    li_previous.innerText = 'Previous subtitle';
    li_previous.addEventListener('click', event => jump_to_previous_subtitle(context));
    ul.appendChild(li_previous);

    let li_next = document.createElement('li');
    li_next.classList.add('subtitle-next');
    li_next.innerText = 'Next subtitle';
    li_next.addEventListener('click', event => jump_to_next_subtitle(context));
    ul.appendChild(li_next);

    context.video_container.appendChild(ul);
}

function handle_keypress(context, event) {
    if (event.ctrlKey || event.altKey || event.metaKey) {
        return;
    }

    if (event.key == ' ') {
        if (context.video.paused) {
            context.video.play();
        } else {
            context.video.pause();
        }
    } else if (event.key == 'ArrowLeft') {
        jump_to_previous_subtitle(context);
    } else if (event.key == 'ArrowRight') {
        jump_to_next_subtitle(context);
    } else if (event.key == 'v') {
        cycle_subtitles_track(context);
    } else if (event.key == 'V') {
        disable_subtitles(context);
    } else {
        return;
    }
    event.preventDefault();
}

function enable_all_subtitles(video) {
    let context = create_subtitle_context(video);
    create_subtitles_navigator(context);
    create_subtitles_selector(context);
    set_subtitles_track_default(context);

    const storage_key = 'currentTime-' + location.pathname;
    context.video.currentTime = localStorage.getItem(storage_key) || 0;
    context.video.addEventListener('timeupdate', function(event) {
        localStorage.setItem(storage_key, context.video.currentTime);
    })

    // TODO
    window.addEventListener('keydown', event => handle_keypress(context, event));
}

function main() {
    $$('video').forEach(enable_all_subtitles);
}

window.addEventListener('DOMContentLoaded', main);
})();
