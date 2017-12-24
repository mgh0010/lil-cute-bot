'use strict';

require('dotenv').config();
var ddg = require('ddg-api');
var client = new ddg.SearchClient({useSSL: true});
const request = require('request');


const https = require('https');

var calendar = {'monday':[['Cafe English', '7:00pm', 1140], 
                          ['Freshman Throwdown', '7:00pm', 1140]],
                'tuesday':[['Free Dinner', '6:00pm', 1080]],
                'wednesday':[['Movie Night', '7:00pm', 1140]],
                'thursday':[['Worship and Bible Study', '8:00pm', 1200]],
                'friday':[['Movie in Conf. Room', '8:00pm', 1200],
                          ['Walmart Run', '8:00pm', 1200],
                          ['Paint War', '9:00pm', 1260]],
                'saturday':[['Board Game Night', '7:30pm', 1170]],
                'sunday':[['First Sunday', '6:00pm', 1080]],
               };

var apiKey = 'e0ad9a5d7731f07a87d6ac20e6379ca7';
var darkSkyApiKey = '21e7d440c2a31cfb2fca848d35caf927';
var darkSkyUrlPathHeader = `https://api.darksky.net/forecast/${darkSkyApiKey}/`;
var googleGeocodeApiKey = '&key=AIzaSyACpDnJsp7wQjuNs0Ig4SMCbUJvysmhiII';
var googleGeocodePathHeader = `https://maps.googleapis.com/maps/api/geocode/json?address=`;
var weatherInfo = 'none';
var days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
var cityIds = {'auburn': 4830796, 'piedmont': 4083004, 'hoover': 4067994};
var regexPatterns = [];

const esvRegex = /^\/bible/;
regexPatterns.push(esvRegex);
const shrugRegex = /^\/shrug/;
regexPatterns.push(shrugRegex);
const heyRegex = /^\s*(hi|hey|hello)$/;
regexPatterns.push(heyRegex);
const timeRegex = /^\s*what time is it/;
regexPatterns.push(timeRegex);
const eventsRegex = /^\s*\/events(\son (friday|monday|tuesday|wednesday|thursday|sunday|saturday))?/;
regexPatterns.push(eventsRegex);
const addEventRegex = /^\s*\/add\s\w(\w|\s|\d|\*|\.)+@\s*\d{1,2}:\d{2}(a|A|p|P)m\son (friday|monday|tuesday|wednesday|thursday|sunday|saturday)/;
regexPatterns.push(addEventRegex);
const weatherRegex = /^weather/;
regexPatterns.push(weatherRegex);
const weatherForecastRegex = /^weather.*forecast/;
regexPatterns.push(weatherForecastRegex);
const forecastHighAndLowsRegex = /^forecast/;
regexPatterns.push(forecastHighAndLowsRegex);
const helpRegex = /^\/(help|what can do)$/;
regexPatterns.push(helpRegex);
const decideRegex = /^\/decide/;
regexPatterns.push(decideRegex);
const adviceRegex = /^\/advice/;
regexPatterns.push(adviceRegex);
const thatReallyRegex = /^\/that really/;
regexPatterns.push(thatReallyRegex);
const ddgRegex = /^\//;
regexPatterns.push(ddgRegex);
const newWeatherRegex = /^new weather/;
regexPatterns.push(newWeatherRegex);



function addEvent(msg) {
    msg = msg.trim();
    msg = msg.slice(5);
    let msgParts = msg.split("@");
    let event = msgParts[0].trim();
    let timeAndDay = msgParts[1].trim();
    let timeAndDayParts = timeAndDay.split("on");
    let timeString = timeAndDayParts[0].trim();

    let absTime = getabsTimeFromTimeString(timeString);

    let day = timeAndDayParts[1].trim().toLowerCase();
    for (var i = 0; i < calendar[day].length - 1; i++) {
        if (absTime <= calendar[day][i][2]) {
            calendar[day].splice(i,0,[event, timeString, absTime]);
            return 'Event \"' + event + '\" @ ' + timeString + ' on ' + day + ' added to calendar.'; 
        }
    }
    calendar[day].push([event, timeString, absTime]);
    return 'Event \"' + event + '\" @ ' + timeString + ' on ' + day + ' added to calendar.'; 
}

function getDayString(date) {
    let dayString = '';
    let dayInt = date.getDay();
    switch (dayInt) {
        case 0:
            dayString = 'sunday';
            break;
        case 1:
            dayString = 'monday';
            break;
        case 2:
            dayString = 'tuesday';
            break;
        case 3:
            dayString = 'wednesday';
            break;
        case 4:
            dayString = 'thursday'
            break;
        case 5:
            dayString = 'friday';
            break;
        case 6:
            dayString = 'saturday';
            break;
        default:
            dayString = 'Do not know';
            break;
    }

    return dayString;

}

function getabsTimeFromTimeString(timeString) {
    let absTime = 0;
    let hoursMinArray = timeString.split(":");
    let hours = hoursMinArray[0];
    let minAMPM = hoursMinArray[1];
    let minutes = minAMPM.slice(0,2);
    let amOrPm = minAMPM.slice(2).toLowerCase();
    if (amOrPm == 'pm') {
     absTime += 12*60;
    }
    absTime += hours*60;
    absTime += minutes;

   return (absTime/100);
}

function getCalendar(todayString, message) {
    message = message.trim();
    let dayToUse = '';
    if (message.length < 8) {
        dayToUse = todayString;
    }
    else {
        let eventsAndMsgArray = message.split(" on ");
        dayToUse = eventsAndMsgArray[1].toLowerCase();
    }
    let eventsString = '';
    let needNewTimeSection = false;
    let currentTimeSection = '12:00am';
    let eventsOnDayArray = calendar[dayToUse];
    let isNotFirstTimeSection = false;
    eventsOnDayArray.forEach(function(eventArray) {
        if (currentTimeSection != eventArray[1]) {
            needNewTimeSection = true;
            currentTimeSection = eventArray[1];
        }
        if (needNewTimeSection) {
            if(isNotFirstTimeSection){
                eventsString += '-----------------------------------\n';
            }
            eventsString += currentTimeSection + ':\n';
        }

        eventsString += '--> ';
        eventsString += eventArray[0] + '\n';
        needNewTimeSection = false;
        isNotFirstTimeSection = true;
    })
    return eventsString;
}


/**
 * Sends a message to GroupMe with a POST request.
 *
 * @static
 * @param {string} messageText A message to send to chat
 * @return {undefined}
 */
function sendMessage(messageText) {
    // Get the GroupMe bot id saved in `.env`
    const botId = process.env.BOT_ID;

    const options = {
        hostname: 'api.groupme.com',
        path: '/v3/bots/post',
        method: 'POST'
    };

    const body = {
        bot_id: botId,
        text: messageText
    };

    // Make the POST request to GroupMe with the http module
    const botRequest = https.request(options, function(response) {
        if (response.statusCode !== 202) {
            console.log('Rejecting bad status code ' + response.statusCode);
        }
    });

    // On error
    botRequest.on('error', function(error) {
        console.log('Error posting message ' + JSON.stringify(error));
    });

    // On timeout
    botRequest.on('timeout', function(error) {
        console.log('Timeout posting message ' + JSON.stringify(error));
    });

    // Finally, send the body to GroupMe as a string
    botRequest.end(JSON.stringify(body));
};

function getDarkSkyWeather(addressString) {
  addressString = addressString.replace(/\s/g, '+');
  //api key and path header available
  let addressLatLongDict = {};
  let requestUrl = googleGeocodePathHeader + addressString + googleGeocodeApiKey;
  request(requestUrl, function(err, response, body) {
    if(err) {
      return err;
    }
    else {
      let bodyObj = JSON.parse(body);
      let address = bodyObj.results[0].formatted_address;
      let lat = bodyObj.results[0].geometry.location.lat;
      let long = bodyObj.results[0].geometry.location.lng;
      addressLatLongDict = {'address': address, 'lat': lat.toString(), 'long': long.toString()};
      let requestUrl = darkSkyUrlPathHeader + addressLatLongDict['lat'] + ',' + addressLatLongDict['long'];
      request(requestUrl, function(err, response, body) {
        if(err) {
          weatherInfo = err;
        }
        else {
          let bodyObj = JSON.parse(body);
          let currentlySummary = bodyObj.currently.summary;
          let minutelySummary = bodyObj.minutely.summary;
          let hourlySummary = bodyObj.hourly.summary;
          let dailySummary = bodyObj.daily.summary;
          weatherInfo = `Address: ${addressLatLongDict['address']}\n`;
          // weatherInfo += currentlySummary + '\n';
          weatherInfo += minutelySummary + '\n';
          weatherInfo += hourlySummary + '\n';
          weatherInfo += dailySummary + '\n';
          sendMessage(weatherInfo);

        }
      })
    }
  })
    
}

function getWeather(cityId) {
    weatherInfo = 'If you see this, it is not working';
    let url = `http://api.openweathermap.org/data/2.5/weather?id=${cityId}&units=imperial&appid=${apiKey}`
    let urlminMax = `http://api.openweathermap.org/data/2.5/forecast/daily?id=${cityId}&units=imperial&appid=${apiKey}`
    request(url, function (err, response, body) {
      if(err){
        weatherInfo = err;
      } 
      else {
        let weather = JSON.parse(body);
        let description = weather.weather[0].description
        description.charAt(0).toUpperCase();
        weatherInfo = `|------ ${weather.name} ---------------|\nRight now there's ${description}\nCurrently: ${weather.main.temp}\n`;
        weatherInfo += 'Today' 
        // pass in 0 because zero days from now
        getHighAndMin(weatherInfo, 0, cityId);
      }
    });


    return null;
}

function getHighAndMin(dayAsString, daysFromNow, cityId) {
    let tempRange = {'high': '', 'low': '', 'day': ''};
    let url= `http://api.openweathermap.org/data/2.5/forecast/daily?id=${cityId}&units=imperial&appid=${apiKey}`
    request(url, function (err, response, body) {
      if(err){
        weatherInfo = err;
      } 
      else {
        let weather = JSON.parse(body);
        let list = weather.list;
        tempRange['high'] = list[daysFromNow].temp.max;
        tempRange['low'] = list[daysFromNow].temp.min;
        weatherInfo = '';
        weatherInfo += `${dayAsString} ------------\nLow: ${tempRange['low']}\nHigh: ${tempRange['high']}`;
        weatherInfo += '\nExpect: ' + list[daysFromNow].weather[0].description;

        sendMessage(weatherInfo);
      }
    });
}

function getForecastHighLows(cityId, daysToLookAhead=3) {
  let d = new Date();
  let dayString = getDayString(d);
  let dayIndex = getIndexOfDay(dayString);
  for(let i = 0; i < daysToLookAhead; i++) {
    weatherInfo = days[dayIndex] + '\n';
    if (i == 0) {
      getWeather(cityId);
    }
    else {
      getHighAndMin(weatherInfo, i, cityId);
    }

    if(dayIndex == 6) {
        dayIndex = 0;
    } 
    else {
        dayIndex += 1;
    }
  } 
}

function getForecast(cityId) {
    weatherInfo = 'If you see this, it is not working';
    let url = `http://api.openweathermap.org/data/2.5/forecast?id=${cityId}&units=imperial&appid=${apiKey}`
    request(url, function (err, response, body) {
      if(err){
        weatherInfo = err;
      } 
      else {
        let weather = JSON.parse(body);
        let list = weather.list;
        let todayChar = list[0].dt_txt.charAt(9);
        let d = new Date();
        let dayString = getDayString(d);
        let dayIndex = getIndexOfDay(dayString);
        weatherInfo = dayString + '\n--------------\n';
        list.forEach(function(threeHourWeather) {
            dayString = getDayString(d);
            let dayChar = threeHourWeather.dt_txt.charAt(9);
            let timestring = threeHourWeather.dt_txt.substring(11, 16);
            let temp = threeHourWeather.main.temp;
            if(dayChar != todayChar) {
                todayChar = dayChar;
                if(dayIndex == 6) {
                    dayIndex = 0;
                } 
                else {
                    dayIndex += 1;
                }
                weatherInfo += '\n\n' + days[dayIndex] + '\n--------------\n';
            }
            // weatherInfo += timestring + '|'; 
            weatherInfo += temp + '|' 
            weatherInfo += threeHourWeather.weather[0].description;
            weatherInfo += ', '
        })
        sendMessage(weatherInfo);
      }
    });
}

function getIndexOfDay(day) {
    if(day == 'sunday') {return 0;}
    else if(day == 'monday') {return 1;}
    else if(day == 'tuesday') {return 2;}
    else if(day == 'wednesday') {return 3;}
    else if(day == 'thursday') {return 4;}
    else if(day == 'friday') {return 5;}
    else if(day == 'saturday') {return 6;}
}

function showWhatTheyCanDo() {
  let whatTheyCanDo = 'Here are the things you can do:\n'
  for(let i = 0; i < regexPatterns.length; ++i) {
    whatTheyCanDo += `"${regexPatterns[i]}"\n`;
  }

  sendMessage(whatTheyCanDo);
}

function yesNoApiResponse() {
  let url = `https://yesno.wtf/api/`
  request(url, function (err, response, body) {
    if(err) {
      sendMessage(err);
    }
    else {
      let answer = JSON.parse(body);
      sendMessage(answer.image);
    }
  });
}


function adviceResponse() {
  let url = `http://api.adviceslip.com/advice`
  request(url, function (err, response, body) {
    if(err) {
      sendMessage(err);
    }
    else {
      let answer = JSON.parse(body);
      sendMessage(answer.slip.advice);
    }
  });
}

function thatReallyResponse() {
  let url = `http://api.chew.pro/trbmb`
  request(url, function (err, response, body) {
    if(err) {
      sendMessage(err);
    }
    else {
      body = body.replace('[', '');
      body = body.replace(']', '');
      body = body.replace('"', '');
      body = body.replace('"', '');
      sendMessage(body);
    }
  });
}

function getDdgResponse(query) {
  query = query.substring(1);
  query = query.replace(/\s/g, '+');
  let url = `https://api.duckduckgo.com/?q=${query}&format=json`
  request(url, function (err, response, body) {
    if(err) {
      sendMessage(err);
    }
    else {
      let answer = JSON.parse(body);
      if (answer.Abstract != "") {
        sendMessage(answer.AbstractText);
      }
      else {
        sendMessage('Couldn\'t find a quick answer for that!')
      }
    }
  });
}

function getBibleESVResponse(query) {
  query = query.substring(1);
  query = query.replace(/bible /, '');
  query = query.replace(/\s/g, '+');
  let url = `http://labs.bible.org/api/?passage=${query}&type=json`
  request(url, function (err, response, body) {
    if(err) {
      sendMessage(err);
    }
    else {
      if (body != "") {
        let returnString = '';
        let passageInfo = JSON.parse(body);
        let isFirstVerse = true;
        let limit = 4;
        let count = 0;
        // let notSentYet = true;
        passageInfo.forEach(function(passage) {
          if(isFirstVerse) {
            returnString += `${passage.bookname} ${passage.chapter}\n`;
            isFirstVerse = false;
          }
          if(passage.title) {
            returnString += passage.title + '\n---------------------\n';
          }
          returnString += `(${passage.verse}) ${passage.text}`; 
          if(count == limit) {
            // notSentYet = false;
            sendMessage(returnString);
            returnString = '';
            count = 0;
          }
          count++;

        })
        // if(notSentYet) {
          sendMessage(returnString);
        // }
      }
      else {
        sendMessage('Couldn\'t find that verse!')
      }
    }
  });
}


/**
 * Called when the bot receives a message.
 *
 * @static
 * @param {Object} message The message data incoming from GroupMe
 * @return {string}
 */
function checkMessage(message) {
  const messageText = message.text.toLowerCase();

  let d = new Date();
  let hours = d.getHours();
  let minutes = d.getMinutes();
  let minutesIsSingleDigit = false;
  let isAM = true;
  let todayString = getDayString(d);

  if (minutes < 10) {
      minutesIsSingleDigit = true; 
  }
  if (hours >= 12) {isAM = false;}
  if (hours > 12) {
      hours = hours - 12;
  }
  let time = hours + ':';
  if (minutesIsSingleDigit) {
      time += '0';
  }
  time += minutes;
  if (isAM){time += 'am';}
  else {time += 'pm'}
  let timeResponse = 'Time to get a watch... but really it\'s ' + time;

  // Check if the GroupMe message has content and if the regex pattern is true
  if (messageText && shrugRegex.test(messageText)) {return '¯\\_(ツ)_/¯';}
  else if (messageText && heyRegex.test(messageText)) {return 'I\'m cute';}
  else if (messageText && timeRegex.test(messageText)) {return timeResponse;}
  else if (messageText && esvRegex.test(messageText)) {
    getBibleESVResponse(messageText);
  }
  else if (messageText && newWeatherRegex.test(messageText)) {
      if (messageText.includes("new weather pie"))
      {
        getDarkSkyWeather('piedmont, al');
      }
      else if (messageText.includes("new weather hoo"))
      {
        getDarkSkyWeather('hoover, al');
      }
      else
      {
        getDarkSkyWeather('auburn, al');
      }
      return null;
  }
  else if (messageText && weatherForecastRegex.test(messageText)) {
      if (messageText.includes("weather forecast pie"))
      {
        getForecast(cityIds['piedmont']);
      }
      else if (messageText.includes("weather forecast hoo"))
      {
        getForecast(cityIds['hoover']);
      }
      else
      {
        getForecast(cityIds['auburn']);
      }
      return null;
  }
  else if (messageText && weatherRegex.test(messageText)) {
      if (messageText.includes("weather pie"))
      {
        getWeather(cityIds['piedmont']);
      }
      else if (messageText.includes("weather hoo"))
      {
        getWeather(cityIds['hoover']);
      }
      else
      {
        getWeather(cityIds['auburn']);
      }
  }
  else if (messageText && eventsRegex.test(messageText)) {
      return getCalendar(todayString, messageText);
  }
  else if (messageText && addEventRegex.test(messageText)) {
      return addEvent(messageText);
  }
  else if (messageText && forecastHighAndLowsRegex.test(messageText)) {
    if (messageText.includes("forecast pie"))
    {
      getForecastHighLows(cityIds['piedmont']);
    }
    else if (messageText.includes("forecast hoo"))
    {
      getForecastHighLows(cityIds['hoover']);
    }
    else
    {
      getForecastHighLows(cityIds['auburn']);
    }
    return null;
  }
  else if (messageText && helpRegex.test(messageText)) {
    showWhatTheyCanDo();
    // have global array that contains regex patterns
    //What can do function(help)
    return null;
  }
  else if (messageText && decideRegex.test(messageText)) {
    yesNoApiResponse();
  }
  else if (messageText && adviceRegex.test(messageText)) {
    adviceResponse();
  }
  else if (messageText && thatReallyRegex.test(messageText)) {
    thatReallyResponse();
  }
  else if (messageText && ddgRegex.test(messageText)) {
    getDdgResponse(messageText);
  }
  //TODO
  //Display remaining weekend weather
  else {return null;}
};


module.exports.checkMessage = checkMessage;
module.exports.addEvent = addEvent;
module.exports.getDayString = getDayString;
module.exports.getabsTimeFromTimeString = getabsTimeFromTimeString;
module.exports.getCalendar = getCalendar;
module.exports.sendMessage = sendMessage;
module.exports.getWeather = getWeather;
module.exports.getForecast = getForecast;
module.exports.getForecastHighLows = getForecastHighLows;
module.exports.getHighAndMin = getHighAndMin;
module.exports.checkMessage = checkMessage;
module.exports.showWhatTheyCanDo = showWhatTheyCanDo;
