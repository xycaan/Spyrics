const e = require('electron')
const https = require('https')
const htmlparser = require('htmlparser2')
const NodeSpotify = require("node-spotify-helper")

var win, data, lyricParser, lyrics, inLyrics = false, spotifyHelper = new NodeSpotify.SpotifyWebHelper(), spotifyConnected = false, status = "", sender, oldSong = "";


function createWindow() {

    win = new e.BrowserWindow({ //create window and set some properties
        useContentSize: true,
        transparent: false,
        resizable: true,
        darkTheme: true,
        icon: __dirname + "/icon.png"
    })

    win.setMenu(null); //dont need tool bar at top

    win.loadURL(__dirname + '/main.html') //Load html file into window

    win.on('closed', function () { //If window is to be closed delete ref to it
        win = null;
    })

    e.app.on('window-all-closed', () => {
        e.app.quit()
    })

    lyricParser = new htmlparser.Parser({  //Object to get the lyrics text from html data
        onopentag: function (name, attribs) {
            if (attribs.class == "mxm-lyrics__content ") {
                inLyrics = true
            }
        },
        ontext: function (text) {
            if (inLyrics) {
                lyrics += text
            }
        },
        onclosetag: function (name, attribs) {
            inLyrics = false
        }
    })


    e.ipcMain.on('lyrics', function (event) { //Listener for when renderer asks for lyrics
        lyrics = ""
        data = ""
        if(spotifyConnected){ //Only try and update lyrics if connect to spotify web helper
            spotifyHelper.status().then(updateLyrics)
        }
        sender = event.sender
    })

    connectSpotify();

}

e.app.on('ready', createWindow) //When everything is loaded create window

async function connectSpotify() { //Try and connect to spotify web helper
    await spotifyHelper.connect()
    spotifyConnected = true
    console.log("Connected to spotify!")
}

function fetchLyrics(urlpart) { //Get lyrics data from web, run it through parser and send to renderer
    data = "";
    console.log('https://www.musixmatch.com' + urlpart) //I pull all lyrics from musixmatch
    https.get('https://www.musixmatch.com' + urlpart, function (res) {
        
        res.on('data', (r) => data += r) //Write all incoming data to buffer

        res.on('end', function () {//When no more data

            lyricParser.write(data)//Get lyrics text

            if (data.indexOf("Moved Permanently. Redirecting to") != -1) { //If its a redirect, run the function again with new url
                fetchLyrics(data.substring(data.indexOf('/'), data.length));
            } else {
                if(lyrics == ""){
                    lyrics = "Sorry! Lyrics could not be found for this song." //If 404'd or url doesnt work, tell user lyrics cant be found
                }
                sender.send('lyrics', lyrics); //Send lyrics to renderer
            }
        })
    })
}

function updateLyrics(x) { //Make sure song needs updating and then format name and artist so lyrics can be fetched
    if (x.current.track.uri != oldSong) {
        oldSong = x.current.track.uri;

        var artist = x.current.artist.name;
        var track = x.current.track.name;

        lyrics += "<b>" + artist + " - " + track + "</b><br><br>" //Add artist - track at top of lyrics page

        artist = parseName(x.current.artist.name)

        track = track.split("-")[0] //get rid of any "[track] - special edition" stuff
        track = track.replace("Remastered", ""); //Get rid of "Remastered" on tracks
        track = track.split("(")[0] //get rid of any "(feat [artist]) trailing text
        track = parseName(track)

        fetchLyrics("/lyrics/" + artist + "/" + track);
    }
}

function parseName(unparsed) { //Remove spaces, dots, etc to make it url friendly
    var result = unparsed.replaceAll(" ", "-");
    result = result.replaceAll(".", "-")
    result = result.replaceAll(",","-")
    result = result.replace(/-+/g, '-');
    while(result.charAt(result.length-1) == '-'){
        result = result.substring(0, result.length-1);
    }
    return result;
}

String.prototype.replaceAll = function (find, replace) { //Function to overrite all instances of a single character in string
    var result = this;
    return result.split(find).join(replace);
};