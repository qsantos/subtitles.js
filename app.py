from pathlib import Path

from flask import Flask, render_template, abort, redirect, url_for

STATIC_DIR = Path(__file__).parent / 'static'
app = Flask(__name__, static_folder=STATIC_DIR)

languages = {
    None: 'Default',
    'eng': 'English',
    'fre': 'French',
    'jpn': 'Japanese',
}
supported_subtitles_extensions = ['vtt', 'srt']


@app.route('/')
def index():
    return redirect(url_for('browse'))


@app.route('/browse/')
@app.route('/browse/<path:path>')
def browse(path=''):
    path = STATIC_DIR / path
    if not path.exists():
        abort(404)

    if path.is_dir():
        directories = sorted(
            p.relative_to(STATIC_DIR)
            for p in path.iterdir()
            if not p.name.startswith('.')
            if p.is_dir()
        )
        files = sorted(
            p.relative_to(STATIC_DIR)
            for p in path.iterdir()
            if not p.name.startswith('.')
            if not p.is_dir()
            if p.name.endswith('.mp4') or p.name.endswith('.webm')
        )

        return render_template(
            'listing.html',
            path=path.relative_to(STATIC_DIR),
            directories=directories,
            files=files,
        )
    else:
        subtitles = []
        for code, label in languages.items():
            for extension in supported_subtitles_extensions:
                if code is None:
                    subtitle_filename = '.'.join([path.stem, extension])
                else:
                    subtitle_filename = '.'.join([path.stem, code, extension])
                subtitle_path = path.parent / subtitle_filename
                if subtitle_path.exists():
                    subtitles.append([code, label, subtitle_path.relative_to(STATIC_DIR)])
                    break

        return render_template(
            'file.html',
            path=path.relative_to(STATIC_DIR),
            file=path,
            subtitles=subtitles,
        )

application = app
