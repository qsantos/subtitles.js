<?php
function endswith($string, $suffix) {
    $length = strlen($suffix);
    return $length == 0 || substr($string, -$length) === $suffix;
}

function listing($path = '.') {
    $ret = array('files' => array(), 'directories' => array());
    $directories = array();
    foreach (scandir($path) as $filename) {
        if ($filename[0] === '.') {
            continue;
        }

        if (is_dir($filename)) {
            $ret['directories'][] = $filename;
        } else {
            $ret['files'][] = $filename;
        }
    }
    return $ret;
}


$path = isset($_GET['path']) ? $_GET['path'] : '.';
if (preg_match('!^/|(^|/)\.\.(/|$)!', $path) || !is_dir($path)) {
    echo 'Invalid path';
    exit(0);
}
$languages = array(
    '' => 'Default',
    'en' => 'English',
    'fr' => 'French',
    'ja' => 'Japanese'
);

$title = 'Rikaichan friendly subtitles';
$title .= ' - Listing ' . $path;
$video = false;
$poster = false;
$subtitles = array();
if (isset($_GET['file'])) {
    $file = $path . '/' . $_GET['file'];
    if (endswith($file, 'webm') || endswith($file, 'mp4')) {
        $video = $file;
        $title .= ' - Watching ' . $video;
        $basename = pathinfo($video, PATHINFO_DIRNAME) . '/' . pathinfo($video, PATHINFO_FILENAME);
        foreach (["jpg", "png"] as $extension) {
            $filename = $basename . '.' . $extension;
            if (is_file($filename)) {
                $poster = $filename;
                break;
            }
        }
        foreach ($languages as $code => $label) {
            // first look for vtt
            $filename = $code ? $basename . '.' . $code . '.vtt' : $basename . '.vtt';
            if (is_file($filename)) {
                $subtitles[$code] = $filename;
                continue;
            }

            // fallback to srt
            $filename = $code ? $basename . '.' . $code . '.srt' : $basename . '.srt';
            if (is_file($filename)) {
                $subtitles[$code] = $filename;
            }
        }
        if ($subtitles) {
            $title .= ' (with subtitles)';
        }
    }
}

?>
<!DOCTYPE html>
<meta charset="utf-8">
<title><?php echo $title ?></title>
<style>
.video-container {
    position: relative;
}
video {
    transition-duration: .2s;
    max-width: 100vw;
    max-height: calc(100vh - 30px - 4em);
    display: block;
    margin:1px auto;
}
.subtitle-outer {
    position: absolute;
    bottom: 40px;
    text-align: center;
    color: #fff;
    text-shadow: #000 0px 0px 12px;
    width:100%;
}
.subtitle-inner {
    display: inline-block;
    background: rgba(0,0,0,.4);
    font-family: IPAMincho !important;
    font-size: 46px;
}
.subtitle-inner * {
    font-family: IPAMincho !important;
}
.subtitle-selector, .subtitle-navigator {
    list-style-type: none;
    display: table;
    table-layout: fixed;
    border-collapse: collapse;
    width: calc(100vw - 150px);
    margin: 0 auto;
}
.subtitle-option, .subtitle-previous, .subtitle-next {
    display: table-cell;
    border:1px solid black;
    height: 2em;
    text-align: center;
    vertical-align: middle;
}
main {
    max-width: 50em;
    margin:0 auto;
}
</style>
<script src="subtitles.js"></script>
<?php

if ($video) {
    $options = 'controls preload="auto"';
    if ($poster) {
        $options .= ' poster="' . $poster . '"';
    }
    echo '<video ' . $options . '>';
    echo '<source src="' . $video . '">';
    foreach ($subtitles as $code => $filename) {
        $label = $languages[$code];
        $options = '';
        $options .= ' kind="x-subtitles"';
        $options .= ' label="' . $label . '"';
        $options .= $code ? ' srclang="' . $code . '"' : ' default';
        $options .= ' src="' . $filename . '"';
        echo '<track' . $options . '>';
    }
    echo '</video>';
}

$content = listing($path);

echo '<main>';
echo 'Directories:';
echo '<ul>';
$parent_directory = dirname($path);
if ($parent_directory === '.') {
    echo '<li><a href="/">..</a></li>';
} else {
    echo '<li><a href="/?path='.$parent_directory.'">..</a></li>';
}
foreach ($content['directories'] as $directory) {
    $subpath = $path . '/' . $directory;
    $subpath = preg_replace('!^\./!', '', $subpath);
    echo '<li><a href="/?path='.$subpath.'">'.$directory.'</a></li>';
}
echo '</ul>';

echo 'Files:';
echo '<ul>';
foreach ($content['files'] as $filename) {
    $file = $path . '/' . $filename;
    if (endswith($file, '.mp4') || endswith($file, '.webm')) {
        echo '<li><a href="/?path='.$path.'&file='.$filename.'">'.$filename.'</a></li>';
    }
}
echo '</ul>';
echo '</main>';
?>
