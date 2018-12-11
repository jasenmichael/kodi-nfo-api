const fs = require('fs')
const {xml2js} = require('xml-js')
const express = require("express")
const bodyParser = require("body-parser")
const axios = require('axios')
const app = express();
const ip = require("ip")


app.use(bodyParser.json())
app.use(bodyParser.urlencoded({extended: true}))

// global variables/config
const port = 3000
const thisApiUrl = `http://${ip.address()}:${port}`
const moviesPath = '/mnt/nas/Videos/movies/'
// const tvSeriesPath = '/mnt/nas/Videos/tv/'
// const musicPath = '/mnt/nas/Music/Sorted-Music'
const videoEXT = ['mp4', 'm4v', 'mkv', 'avi', 'wma'] 
// change this to be served by express
const hostedPath = `http://server/`

const server = app.listen(port, function () {
    console.log("=================================")
    console.log("Kodi static nfo api running") 
    console.log("   ", thisApiUrl)

    console.log("=================================")
    console.log("    ")
    loadCache()
})


// ---start--- / endoint -- returns endpoints
app.get("/", (req, res) => {
    res.status(200).send([
        thisApiUrl + '/movies',
        thisApiUrl + 'movies/count',
        thisApiUrl + 'movie/title (year)'
    ])
}); // ---end--- / endoint

// ---start--- /movies endoint -- returns an array of movies
let movies = []
app.get("/movies", (req, res) => {
    console.log("request to endpoint", `/movies`)
    // get count to decide if we use cache or not
    axios.get(`${thisApiUrl}/movies/count`)
        .then(fetched => {
            return fetched.data.count
        })
        .then((count) => {
            if (movies.length === count) {
                console.log('cache count and current count equal')
                console.log("  -- gettting data from cache")
                console.log("===================")
                res.status(200).send(movies)
                return
            } else {
                console.log('there is no cache or cache count and current count not equal')
                console.log("  -- gettting data from movie .nfo files")
                console.info("===================")
                fs.readdir(moviesPath, (err, items) => {
                    movies = []
                    if (err) {
                        console.log('error')
                    }
                    console.log("populating cache")
                    for (var i = 0; i < items.length; i++) {
                        let movieDir = `${moviesPath}${items[i]}`
                        let thumb = ''
                        // get the thumb
                        if (fs.existsSync(`${movieDir}/${items[i]}-thumb.jpg`)) {
                            thumb = encodeURI(`${hostedPath}movies/${items[i]}/${items[i]}-thumb.jpg`)
                        }
                        if (fs.existsSync(`${movieDir}/folder.jpg`)) {
                            thumb = encodeURI(`${hostedPath}movies/${items[i]}/folder.jpg`)
                        }

                        // add .nfo dat to list if .nfo exists.
                        if (fs.existsSync(`${movieDir}/${items[i]}.nfo`)) {
                            let xml = fs.readFileSync(`${movieDir}/${items[i]}.nfo`, 'utf8')
                            let movieNfo = xml2js(xml, {
                                compact: true,
                                ignoreDeclaration: true,
                                ignoreComment: true
                            })
                            let rating = 0
                            if (movieNfo.movie.rating != undefined) {
                                rating = movieNfo.movie.rating._text
                            }
                            let mpaa = 'NR'
                            if (movieNfo.movie.mpaa != undefined) {
                                mpaa = movieNfo.movie.mpaa._text
                            }
                            let genres = []
                            if (movieNfo.movie.genre != undefined) {
                                //check if object or array
                                if (!Array.isArray(movieNfo.movie.genre)) {
                                    genres.push(movieNfo.movie.genre._text)
                                }
                                if (Array.isArray(movieNfo.movie.genre)) {
                                    genres = movieNfo.movie.genre.map(genre => genre._text)
                                }
                            }
                            let movieObj = {
                                id: movieNfo.movie.id._text,
                                title: items[i].slice(0, -7),
                                year: items[i].substr(-6).slice(1, -1),
                                tagline: movieNfo.movie.tagline._text,
                                rating,
                                mpaa,
                                thumb: thumb || "",
                                genres,
                                nfoApiUrl: encodeURI(`${thisApiUrl}/movie/${items[i]}`)
                            }
                            movies.push(movieObj)
                        }
                    }

                    if (movies.length === 0) {
                        res.status(200).send({ message: "no directories containing movie.nfo"})
                    } else {
                        movies.sort((a, b) => {
                            return b.year - a.year
                        })
                        res.status(200).send({movies})
                    }
                })
            }
        })
        .catch(() => {})

}); // ---end--- /movies endoint

// ---start--- /movies/:name endoint -- returns movie data
app.get("/movie/:name", (req, res) => {
    var name = req.params.name
    console.log("request to endpoint", `/movie/${name}`)
    if (fs.existsSync(`${moviesPath}/${name}/${name}.nfo`)) {
        let xml = fs.readFileSync(`${moviesPath}/${name}/${name}.nfo`, 'utf8')
        let movieNfo = xml2js(xml, {
            compact: true,
            ignoreDeclaration: true,
            ignoreComment: true
        })

        // get thumb
        if (fs.existsSync(`${moviesPath}/${name}/${name}-thumb.jpg`)) {
            thumb = encodeURI(`${hostedPath}movies/${name}/${name}-thumb.jpg`)
        }
        if (fs.existsSync(`${moviesPath}/${name}/folder.jpg`)) {
            thumb = encodeURI(`${hostedPath}movies/${name}/folder.jpg`)
        } else thumb = null

        // get genres
        let genres = []
        if (movieNfo.movie.genre != undefined) {
            //check if object or array
            if (!Array.isArray(movieNfo.movie.genre)) {
                genres.push(movieNfo.movie.genre._text)
            }
            if (Array.isArray(movieNfo.movie.genre)) {
                genres = movieNfo.movie.genre.map(genre => genre._text)
            }
        }
        
        // get languages
        let languages = []
        if(JSON.stringify(movieNfo.movie.languages) !== '{}') {
            movieNfo.movie.languages._text.split(",").forEach(language => {
                languages.push(language.trim())                
            })
        }
        else {
            languages = undefined
        }

        // get directors
        let directors = []
        if (movieNfo.movie.director != undefined) {
            //check if object or array
            if (!Array.isArray(movieNfo.movie.director)) {
                directors.push(movieNfo.movie.director._text)
            }
            if (Array.isArray(movieNfo.movie.director)) {
                directors = movieNfo.movie.director.map(director => director._text)
            }
        }

        // get writers
        let writers = []
        if (movieNfo.movie.credits != undefined) {
            //check if object or array
            if (!Array.isArray(movieNfo.movie.credits)) {
                writers.push(movieNfo.movie.credits._text)
            }
            if (Array.isArray(movieNfo.movie.credits)) {
                writers = movieNfo.movie.credits.map(writer => writer._text)
            }
        }

        // get producers
        let producers = []
        if (movieNfo.movie.producer) {
            //check if object or array
            if (!Array.isArray(movieNfo.movie.producer)) {
                let producer = {
                    name: movieNfo.movie.producer.name._text,
                    role: movieNfo.movie.producer.role._text
                }
                writers.push(producer)
            }
            if (Array.isArray(movieNfo.movie.producer)) {
                movieNfo.movie.producer.forEach(producer => {
                    producers.push({
                        name: producer.name._text,
                        role: producer.role._text
                    })
                })

            }
        }
                
        // get trailer
        let trailer = {
            url: '',
            source: ''
        }
        if(movieNfo.movie.trailer) {
           let trailerData = decodeURIComponent(movieNfo.movie.trailer._text)
           // if source is hdtrailers 
           if (trailerData.slice(0, 53) === "plugin://plugin.video.hdtrailers_net/video/apple.com/") {
               trailer.url = trailerData.substr(53)
               trailer.source = "apple_movietrailers"
           }
           // if source is youtube
           if (trailerData.slice(0, 57) === "plugin://plugin.video.youtube/?action=play_video&videoid=") {
               trailer.url = "https://www.youtube.com/watch?v=" + trailerData.substr(57)
               trailer.source = "youtube"
               trailer.youtube_id = trailerData.substr(57)
           }
        }



        // get cast
        let cast = []
        if (movieNfo.movie.cast != undefined) {
            //check if object or array
            if (!Array.isArray(movieNfo.movie.genre)) {
                genres.push(movieNfo.movie.genre._text)
            }
            if (Array.isArray(movieNfo.movie.genre)) {
                genres = movieNfo.movie.genre.map(genre => genre._text)
            }
        }

        // construct output movie object
        let movieObj = {
            id: movieNfo.movie.id._text,
            title: movieNfo.movie.title ? movieNfo.movie.title._text : name.slice(0, -7),
            year: movieNfo.movie.year ? movieNfo.movie.year._text : name.substr(-6).slice(1, -1),
            original_title: movieNfo.movie.originaltitle ? movieNfo.movie.originaltitle._text : name.slice(0, -7),
            tagline: movieNfo.movie.tagline ? movieNfo.movie.tagline._text : null,
            plot: movieNfo.movie.plot ? movieNfo.movie.plot._text : null,
            rating: movieNfo.movie.rating ? movieNfo.movie.rating._text : undefined,
            mpaa: movieNfo.movie.mpaa ? movieNfo.movie.mpaa._text : NR,
            thumb,
            genres,
            movie_set: movieNfo.movie.set ? movieNfo.movie.set.name._text : undefined,
            release_date:  movieNfo.movie.premiered ? movieNfo.movie.premiered._text : undefined,
            languages,
            runtime: movieNfo.movie.runtime ? movieNfo.movie.runtime._text : null,
            directors,
            writers,
            producers,

            date_added: movieNfo.movie.dateadded ? movieNfo.movie.dateadded._text : null,
            cast: [{
                name: "yo",
                role: "",
                image: this.name
            }], //add
            fileInfo: {
                path: "",
                video_codec: "",
                aspect_ratio: "",
                width: "",
                height: "",
                duration: "",
            }, //add
            country: 'add me', //add
            trailer,
            links: 'add me', //add
            // trailerData,
            movieNfo
            // thisUrl: encodeURI(`${thisApiUrl}/movie/${name}`)
        }

        res.status(200).send(movieObj)
    }
}) // ---end--- /movies/:name endoint

app.get("/movies/count", (req, res) => {
    let count = 0
    fs.readdir(moviesPath, (err, items) => {
        if (err) {
            console.log(`cannot access ${moviesPath}`)
        }
        for (var i = 0; i < items.length; i++) {
            let movieDir = `${moviesPath}${items[i]}`
            if (fs.existsSync(`${movieDir}/${items[i]}.nfo`)) {
                count = count + 1
            };
        };
        console.log('request to endpoint /movies/count', count)
        res.status(200).send({
            count
        })
        return
    })
}) // ---end--- /movies/count endoint


// init movie list cache
function loadCache() {
    console.log('loading movie list cache')
    axios.get(`${thisApiUrl}/movies`).then(() => {
        console.log('movie list cache loaded')
        console.log("================")
    }).catch(() => {})
}