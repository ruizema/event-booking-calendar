// Names: Rui Ze Ma and Valerie Triassi
// Date: 2018-12-14
// Description: This file executes the logic for the index page of the program,
// where users enter information to create a poll.

'use strict';

var http = require("http");
var fs = require('fs');
var urlParse = require('url').parse;
var pathParse = require('path').parse;
var querystring = require('querystring');

var port = 1337;
var hostUrl = 'http://localhost:'+port+'/';
var defaultPage = '/index.html';

var mimes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
};

// --- Helpers ---
var readFile = function (path) {
    return fs.readFileSync(path).toString('utf8');
};

var writeFile = function (path, texte) {
    fs.writeFileSync(path, texte);
};

// --- Server handler ---
var redirect = function (reponse, path, query) {
    var newLocation = path + (query == null ? '' : '?' + query);
    reponse.writeHeader(302, {'Location' : newLocation });
    reponse.end('302 page déplacé');
};

var getDocument = function (url) {
    var pathname = url.pathname;
    var parsedPath = pathParse(url.pathname);
    var result = { data: null, status: 200, type: null };

    if(parsedPath.ext in mimes) {
        result.type = mimes[parsedPath.ext];
    } else {
        result.type = 'text/plain';
    }

    try {
        result.data = readFile('./public' + pathname);
        console.log('['+new Date().toLocaleString('iso') + "] GET " + url.path);
    } catch (e) {
        // File not found.
        console.log('['+new Date().toLocaleString('iso') + "] GET " +
                    url.path + ' not found');
        result.data = readFile('template/error404.html');
        result.type = 'text/html';
        result.status = 404;
    }

    return result;
};
var sendPage = function (reponse, page) {
    reponse.writeHeader(page.status, {'Content-Type' : page.type});
    reponse.end(page.data);
};

var indexQuery = function (query) {

    var resultat = { exists: false, id: null };

    if (query !== null) {

        query = querystring.parse(query);
        console.log(query);
        if ('id' in query && 'titre' in query &&
            query.id.length > 0 && query.titre.length > 0) {

            resultat.exists = creerSondage(
                query.titre, query.id,
                query.dateDebut, query.dateFin,
                query.heureDebut, query.heureFin);
        } else {
            validData[4] = false;
        }

        if (resultat.exists) {
            resultat.id = query.id;
        }
    }

    return resultat;
};

var calQuery = function (id, query) {
    if (query !== null) {
        query = querystring.parse(query);
        // query = { nom: ..., disponibilites: ... }
        ajouterParticipant(id, query.nom, query.disponibilites);
        return true;
    }
    return false;
};

var getIndex = function (replacements) {
    return {
        status: 200,
        data: readFile('template/index.html'),
        type: 'text/html'
    };
};


// Our code

var mois = [
    'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin',
    'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Dec'
];

var MILLIS_PAR_JOUR = (24 * 60 * 60 * 1000);

/*
The calculateDate function uses a Date object that will calculate the difference
between two dates in the number of days. Source for the Date object:
https://www.w3schools.com/jsref/jsref_obj_date.asp
*/

var calculateDate = function (dateDebut, dateFin) {
    return (dateFin - dateDebut) / MILLIS_PAR_JOUR + 1;
};

// Initialization of global variables to store poll creation data & error states
var sondage = [];
var validData = Array(5);

/*
The creerSondage function creates a new poll using its title, id, and starting
& ending dates & times. The function returns true if and only if all entered
parametres are considered valid, and will return false otherwise. In addition,
it stores the poll information inside the global variable sondage.
*/

var creerSondage = function (titre, id,
                             dateDebut, dateFin,
                             heureDebut, heureFin) {

    // Checking for invalid characters inside id
    var idValid = true;

    for (var i = 0; i < id.length; i++) {

        var char = id[i];
        var isHyphen = char === "-";
        var isDigit = char >= 0 && char <= 9;
        var isLowerLetter = char >= "a" && char <= "z";
        var isUpperLetter = char >= "A" && char <= "Z";

        if (!(isHyphen || isDigit || isLowerLetter || isUpperLetter)) {
            idValid = false;
        }

    }

    // Verifying valid order of hours
    var hoursValid = +heureDebut <= +heureFin;

    // Verifying valid order of dates and limiting poll length to 30 days
    dateDebut = new Date(dateDebut);
    dateFin = new Date(dateFin);
    var datesValid = dateDebut <= dateFin;
    var dateRangeValid = calculateDate(dateDebut, dateFin) <= 30;

    // Verifying that all fields have been filled
    var notEmpty = titre != "" &&
        id != "" &&
        dateDebut != "" &&
        dateFin != "";

    // All conditions are met
    var allValid = idValid &&
                   hoursValid &&
                   datesValid &&
                   dateRangeValid &&
                   notEmpty;

    // Storing poll or error information in global variable, depending on
    // validity of entered data.
    if (allValid) {
        sondage.push({titre:titre,
                      id:id,
                      dateDebut:dateDebut,
                      dateFin:dateFin,
                      heureDebut:heureDebut,
                      heureFin:heureFin});
    } else {
        validData = [idValid, hoursValid, datesValid, dateRangeValid, notEmpty];
    }

    return allValid;

};

/*
The generateSpecificErrors function takes the html string of the index.html page
as parametre, and modifies the generic error message inside to context-specific
ones, depending on the error states stored in the validData global variable.
*/

var generateSpecificErrors = function (html) {

    // Error messages
    var genericErr = "assurez-vous d'entrer des données valides.";
    var idErr = "L'identifiant ne doit que contenir de chiffres, de lettres," +
        " et de tirets (-). ";
    var hoursErr = "L'heure de fin doit être après l'heure de début. ";
    var datesErr = "La date de fin doit être après la date de début. ";
    var dateRangeErr = "La durée maximale d'un sondage est de 30 jours. ";
    var emptyErr = "Veuillez remplir toutes les données.";

    // Matching each potential error to its message
    var condsToErrs = [[validData[0], idErr],
                      [validData[1], hoursErr],
                      [validData[2], datesErr],
                      [validData[3], dateRangeErr],
                      [validData[4], emptyErr]];

    // Determining the correct error message(s)
    var errorMessage = "";

    if (validData === Array(5) || !validData[4]) { // one or more empty field(s)
        return html.replace(genericErr, emptyErr);
    }

    for (var cond = 0; cond < condsToErrs.length; cond++) {
        // Stacking multiple error messages
        if (!condsToErrs[cond][0]) {
            errorMessage += condsToErrs[cond][1];
        }
    }

    return html.replace(genericErr, errorMessage);

};

/*
The indexOfSondageId function returns the index of the poll identified by its
id, inside the polls stored in memory as a global variable. If the sondage does
not exist, it returns -1 instead.
*/

var indexOfSondageId = function (sondageId) {

    for (var i = 0; i < sondage.length; i++) {
        if (sondage[i].id === sondageId) {
            return i;
        }
    }

    return -1;

};

/*
The quote function returns the inputted text, with "" quotes surrounding it.
*/

var quote = function (text) {
    return '"' + text + '"';
};

/*
The daysBetween function returns an array of every date in the time interval
between the parametres date1 and date2, including these two days. Each element
is an object (enregistrement) containing the day and the month of the date.
*/

var daysBetween = function(date1, date2) {
    
    var dateList = [];

    // Iterating through dates by adding exactly one day's worth of seconds in
    // every iteration to form the new date object, then pushing an object
    // containing the day & month numbers to the array.
    for (var i = 1; i <= calculateDate(date1, date2); i++) {
        var date = new Date(date1.getTime() + i * MILLIS_PAR_JOUR);
        dateList.push({day:date.getDate(), month:date.getMonth()});
    }

    return dateList;

};

/*
The tableMaker function takes a poll as its parametre and returns an HTML string
using the <table> tag, containing a grid with the days & hours of the poll as
its columns & rows respectively. The table also has predefined attributes, and
each rectangle in the table is given its own unique id.
*/

var tableMaker = function (poll) {

    // Extracting poll data
    var dateDebut = poll.dateDebut;
    var dateFin = poll.dateFin;
    var heureDebut = poll.heureDebut;
    var heureFin = poll.heureFin;

    // Calculating column & row lengths, and generating array of all dates
    var nbJours = calculateDate(dateDebut, dateFin);
    var nbHeures = heureFin - heureDebut + 1;
    var datesArray = daysBetween(dateDebut, dateFin);

    // Initializing table with attributes
    var table = '<table id="calendrier"' +
                ' onmousedown="onClick(event)"' +
                ' onmouseover="onMove(event)"' +
                ' data-nbjours=' + quote(nbJours) +
                ' data-nbheures=' + quote(nbHeures) + ">\n";

    // Filling the table
    for (var i = -1; i < nbHeures; i++) {

        table += "<tr>\n";

        if (i === -1) { // Setting the first row of day labels

			table += "<th></th>\n";

            for (var j = 0; j < nbJours; j++) {
                // Labeling each day in the DD-Month format, where the month is
                // converted to its abbreviation in French.
                table += "<th>" + datesArray[j].day + " " +
                         mois[datesArray[j].month] + "</th>\n";
            }

        } else { // Every other row

            // First element of each row is the hour label
            table += "<th>" + (+heureDebut + i) + "h" + "</th>\n";

            // Assigning unique ID to each non-label grid element
            for (var j = 0; j < nbJours; j++) {
                table += "<td id=" + quote(j + "-" + i) + "></td>\n"
            }

        }
        table += "</tr>\n";
    }

    table += "\t\t</table>";

    return table;

};

/*
The getCalendar function takes the inputted poll (identified by its ID) and
returns the html string for the corresponding calendar page. The latter is based
off the generic calendar.html, where the placeholders get replaced with the
appropriate information.
*/

var getCalendar = function (sondageId) {

    // Finding the poll from its ID, and detecting when the poll does not exist
    var sondageIndex = indexOfSondageId(sondageId);

    if (sondageIndex === -1) {
        return false;
    }

    // Extracting poll information
    var requestedSondage = sondage[sondageIndex];
    var titre = requestedSondage.titre;
    var id = requestedSondage.id;

    // Generating interactive calendar table
    var table = tableMaker(requestedSondage);

    // Generating calendar page url for sharing
    var url = "http://localhost:1337/" + id;

    // Reading the generic calendar file as a base
    var calendarHtml = readFile("template/calendar.html");

    // Replacing the placeholders inside the html with poll information
    // Source for the .replace() method:
	// https://www.w3schools.com/jsref/jsref_replace.asp
    calendarHtml = calendarHtml.replace("{{titre}}", titre);
    calendarHtml = calendarHtml.replace("{{titre}}", titre);
    calendarHtml = calendarHtml.replace("{{table}}", table);
    calendarHtml = calendarHtml.replace("{{url}}", url);

    return calendarHtml;

};

/*
The ajouterParticipant function is called after the user has indicated their
availabilities on the calendar and entered their name, and it takes these two
pieces of data in addition to the poll ID and stores them inside a global
variable as an object.
*/

var participants = [];

var ajouterParticipant = function (sondageId, nom, disponibilites) {
    participants.push({id:sondageId, nom:nom, dispos:disponibilites});
};

/*
The initializeEmptyArray function takes a poll as parametre, and returns an
empty 2D array where all the elements are also arrays. The size of this array is
determined by the poll information, and corresponds to the size of the calendar
table. (number of days * number of hours)
*/

var initializeEmptyArray = function (poll) {

    var emptyArray = [];

    // Extracting poll data
    var dateDebut = poll.dateDebut;
    var dateFin = poll.dateFin;
    var heureDebut = poll.heureDebut;
    var heureFin = poll.heureFin;

    // Calculating dimensions of array
    var nbJours = calculateDate(dateDebut, dateFin);
    var nbHeures = heureFin - heureDebut + 1;

    // Filling the array with empty arrays
    for (var i = 0; i < nbHeures; i++) {
        emptyArray.push([]);
        for (var j = 0; j < nbJours; j++) {
            emptyArray[i].push([]);
        }
    }

    return emptyArray;

};

/*
The getIndexFromParticipantName function returns the index of a person's entry
inside the participants global variable. This person is identified by thir name.
*/

var getIndexFromParticipantName = function (name) {
    for (var i = 0; i < participants.length; i++) {
        if (participants[i].nom === name) {
            return i;
        }
    }
};

/*
The insertSpan function inserts a single coloured bar (color given by parametre)
inside the td element with the id "j-i", of the htmlTable that is displayed on
the results page of a poll. It indicates the availability of a person
(represented by a unique colour) at a particular time & date.
*/

var insertSpan = function (color, htmlTable, i, j) {

    // Inserted span element (displays a small coloured bar)
    var span = '<span style="background-color: ' +
        color + '; color:' + color + '">.</span>\n';

    // Locations for insertion
    var tdOpenIndex = htmlTable.indexOf('<td id="' + j + "-" + i);
    var tdCloseIndex = htmlTable.indexOf('>', tdOpenIndex);

    return htmlTable.slice(0, tdCloseIndex + 1) +
           span + htmlTable.slice(tdCloseIndex + 1);

};

/*
The getResults returns the html used to display the results page of a poll,
identified by the parametre sondageId. This page contains the id of the poll,
a table showing who is available where in addition to highlighting time slots
where everyone or no one is available, and a legend assigning a unique colour to
each poll participant.
*/

var getResults = function (sondageId) {

    // Pulling results page template
    var resultsHtml = readFile("template/results.html");

    // Url to answer the poll again
    var url = "http://localhost:1337/" + sondageId;

    // Extracting poll information & checking if poll exists
    var sondIndex = indexOfSondageId(sondageId);
    if (sondIndex === -1) {
        return readFile("template/error404.html");
    }
    var currentSondage = sondage[sondIndex];
    var titre = currentSondage.titre;

    // Initializing 2D array to be filled with availability information
    var resultats = initializeEmptyArray(currentSondage);

    // Filling the table with the names of people who are available for every
    // time slot in the table
    for (var p = 0; p < participants.length; p++) {
        for (var i = 0; i < resultats.length; i++) {
            for (var j = 0; j < resultats[i].length; j++) {

                // The name & availabilities of a person
                var person = participants[p];

                if (+person.dispos[resultats[i].length * i + j]) {
					resultats[i][j].push(person.nom);
                }

            }
        }
    }
   
	// Generating the legend
    var legende = "<ul>\n";
    var totalPop = participants.length; // Total number of participants
    var colorList = [];

    for (var i = 0; i < totalPop; i++) {

        // Generating a unique colour for each participant
        var color = genColor(i, totalPop);
        colorList.push(color);

        // Generating html list element
        legende += '\t<li style="background-color: ' + color + '">' +
            participants[i].nom +
            "</li>\n";

    }

    legende += "</ul>\n";

    // Creating the displayed availability table
    var table = tableMaker(currentSondage); // Importing table from getCalendar
    table = table.replace(/<table.*>/, "<table>"); // Removing attributes

    for (var i = 0; i < resultats.length; i++) {
        for (var j = 0; j < resultats[i].length; j++) {

            // html for td identified by an id
            var tdWithId = "<td id=" + quote(j + "-" + i);

            // Colouring a table element in red or green depending on number of
            // people available at that time
            var tdMax = tdWithId + ' class="max"';
            var tdMin = tdWithId + ' class = "min"';
            var names = resultats[i][j];
            var timeSlotSize = names.length;
            if (timeSlotSize === totalPop) {
                table = table.replace(tdWithId, tdMax);
            } else if (timeSlotSize === 0) {
                table = table.replace(tdWithId, tdMin);
            }

            // Adding in the coloured bars indicating availabilities
            for (var p = 0; p < timeSlotSize; p++) {
                var color = colorList[getIndexFromParticipantName(names[p])];
                table = insertSpan(color, table, i, j);
            }

        }
    }

	// Filling the template html
    resultsHtml = resultsHtml.replace("{{url}}", url);
    resultsHtml = resultsHtml.replace("{{titre}}", titre);
    resultsHtml = resultsHtml.replace("{{titre}}", titre);
    resultsHtml = resultsHtml.replace("{{table}}", table);
    resultsHtml = resultsHtml.replace("{{legende}}", legende);

    return resultsHtml;

};

/*
The decToHex function takes a positive decimal number as parametre, and
output the hexadecimal conversion as a string.
*/

var decToHex = function (dec) {

    // Reference table for decimal to hexacimal conversion from 0 to 15
    var hexTable = {
        0: "0",
        1: "1",
        2: "2",
        3: "3",
        4: "4",
        5: "5",
        6: "6",
        7: "7",
        8: "8",
        9: "9",
        10: "A",
        11: "B",
        12: "C",
        13: "D",
        14: "E",
        15: "F"
    };

    // Recursively calculating & converting each digit of the hexadecimal number
    var remainderNum = dec % 16;
    var remainder = hexTable[remainderNum];
    var newDec = Math.floor(dec / 16);
    if (remainderNum === dec) {
        return remainder;
    } else {
        return decToHex(newDec) + remainder;
    }

};

/*
The genColor function returns a unique colour for the ith participant in a poll
of nbTotal participants.
*/
var genColor = function(i, nbTotal) {

    // Formula provided by assignment
    var teinte = i / nbTotal * 360;
    var h = teinte / 60;
    var c = 0.7;
    var x = c * (1 - Math.abs(h % 2 - 1));
    var rgbColor = [0, 0, 0];

    switch (Math.floor(h)) {
        case 0:
            rgbColor[0] = c;
            rgbColor[1] = x;
            break;
        case 1:
            rgbColor[0] = x;
            rgbColor[1] = c;
            break;
        case 2:
            rgbColor[1] = c;
            rgbColor[2] = x;
            break;
        case 3:
            rgbColor[1] = x;
            rgbColor[2] = c;
            break;
        case 4:
            rgbColor[0] = x;
            rgbColor[2] = c;
            break;
        case 5:
            rgbColor[0] = c;
            rgbColor[2] = x;
            break;
    }

    // Converting the 0-255 values for each colour into hexadecimal numbers
    var hexRGB = [];

    for (var c = 0; c < rgbColor.length; c++) {

        var hex = decToHex(Math.floor(255 * rgbColor[c]));

        // Adding an extra 0 if the number is less than 16, to conform to the
        // html colour format.
        if (hex.length === 1) {
            hex = "0" + hex;
        }

        hexRGB.push(hex);
    }

    return "#" + hexRGB[0] + hexRGB[1] + hexRGB[2];

};


/*
 * Création du serveur HTTP
 * Note : pas besoin de toucher au code ici (sauf peut-être si vous
 * faites les bonus)
 */
http.createServer(function (requete, reponse) {
    var url = urlParse(requete.url);

    // Redirect to index.html
    if (url.pathname == '/') {
        redirect(reponse, defaultPage, url.query);
        return;
    }

    console.log(url.pathname);

    var doc;

    if (url.pathname == defaultPage) {
        var res = indexQuery(url.query);

        if (res.exists) {
            redirect(reponse, res.id);
            return;
        } else {
            doc = getIndex(res.data);
        }
    } else {
        var parsedPath = pathParse(url.pathname);

        if (parsedPath.ext.length == 0) {
            var id;

            if (parsedPath.dir == '/') {
                id = parsedPath.base;

                if (calQuery(id, url.query)) {
                    redirect(reponse, '/'+ id + '/results')
                    return ;
                }

                var data = getCalendar(id);

                if(data === false) {
                    redirect(reponse, '/error404.html');
                    return;
                }

                doc = {status: 200, data: data, type: 'text/html'};
            } else {
                if (parsedPath.base == 'results') {
                    id = parsedPath.dir.slice(1);
                    var data = getResults(id);

                    if(data === false) {
                        redirect(reponse, '/error404.html');
                        return;
                    }

                    doc = {status: 200, data: data, type: 'text/html'};
                } else {
                    redirect(reponse, '/error404.html');
                    return;
                }
            }
        } else {
            doc = getDocument(url);
        }
    }
    if (doc.type === "text/html") {
        doc.data = generateSpecificErrors(doc.data);
    }
    sendPage(reponse, doc);

}).listen(port);
