'use strict';

require('dotenv').config();
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
var cityId = '4830796';
var weatherInfo = 'none';
var days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']


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

function getWeather() {
    weatherInfo = 'If you see this, it is not working';
    let url = `http://api.openweathermap.org/data/2.5/weather?id=${cityId}&units=imperial&appid=${apiKey}`
    request(url, function (err, response, body) {
      if(err){
        weatherInfo = err;
      } 
      else {
        let weather = JSON.parse(body);
        let description = weather.weather[0].description
        description.charAt(0).toUpperCase();
        weatherInfo = `${description} with a temp of ${weather.main.temp} degrees in ${weather.name}!`;
        sendMessage(weatherInfo);
      }
    });

    return null;
}

function getTodaysWeather() {
    weatherInfo = 'If you see this, it is not working';
    let url = `http://api.openweathermap.org/data/2.5/forecast?id=${cityId}&units=imperial&appid=${apiKey}`
    request(url, function (err, response, body) {
      if(err){
        weatherInfo = err;
      } 
      else {
        let weather = JSON.parse(body);
        let list = weather.list;
        let todayChar = list[0].dt_txt.charAt(6);
        let d = new Date();
        let dayIndex = getIndexOfDay(getDayString);
        weatherInfo = getDayString(d) + '\n--------------\n';
        list.forEach(function(threeHourWeather) {
            let dayString = getDayString(d);
            let dayChar = threeHourWeather.dt_txt.charAt(6);
            weatherInfo += dayChar + '\n';
            if(dayChar != todayChar) {
                if(dayIndex == 6) {
                    dayIndex = 0;
                } 
                else {
                    dayIndex += 1;
                }
                weatherInfo += days[dayIndex] + '\n';
            }
            weatherInfo += threeHourWeather.weather[0].description;
            weatherInfo += '\n'
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

/**
 * Called when the bot receives a message.
 *
 * @static
 * @param {Object} message The message data incoming from GroupMe
 * @return {string}
 */
function checkMessage(message) {
    const messageText = message.text.toLowerCase();

    const shrugRegex = /^\/shrug/;
    const heyRegex = /^\s*(hi|hey|hello)/;
    const timeRegex = /^\s*(w|W)hat time is it/;
    const eventsRegex = /^\s*\/events(\son ((f|F)riday|(m|M)onday|(t|T)uesday|(w|W)ednesday|(t|T)hursday|(s|S)unday|(s|S)aturday))?/;
    const addEventRegex = /^\s*\/add\s\w(\w|\s|\d|\*|\.)+@\s*\d{1,2}:\d{2}(a|A|p|P)(m|M)\son ((f|F)riday|(m|M)onday|(t|T)uesday|(w|W)ednesday|(t|T)hursday|(s|S)unday|(s|S)aturday)/;
    const weatherRegex = /^.*weather/;
    const weatherTodayRegex = /^.*weather.*today/;

    let d = new Date();
    let hours = d.getHours();
    if (hours < 6) {
        let diff = 6-hours;
        hours = 12 - diff;
    }
    else {
        hours = hours - 6;
    }
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
    else if (messageText && weatherTodayRegex.test(messageText)) {
        getTodaysWeather();
        return null;
    }
    else if (messageText && weatherRegex.test(messageText)) {
        getWeather();
        return null;
    }
    else if (messageText && eventsRegex.test(messageText)) {
        return getCalendar(todayString, messageText);
    }
    else if (messageText && addEventRegex.test(messageText)) {
        return addEvent(messageText);
    }
    //TODO
    //What can do fucntion(help)
    //Display rest of day's weather
    //Display five day forecast
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
module.exports.getTodaysWeather = getTodaysWeather;
module.exports.checkMessage = checkMessage;
