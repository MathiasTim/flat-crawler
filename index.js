'use strict';
const request = require('request')
const htmlparser = require('htmlparser2')
const schedule = require('node-schedule')
const cheerio = require('cheerio')
const nodemailer = require('nodemailer')

const mailConfig = require('./mail-config.json')
const flatWebsites = require('./flat-websites.json').websites

// create reusable transporter object using the default SMTP transport
let transporter = nodemailer.createTransport({
  host: mailConfig.host,
  port: 587,
  secure: false,
  auth: mailConfig.smtpAuth
});

let mailOptions = {
  from: mailConfig.from,
  to: mailConfig.to
};

class FlatCrawler {
  constructor() {
    this.scheduler();
  };

  start () {
    let promises = [];
    flatWebsites.forEach((flat) => {
      promises.push(this.getDataOfUrls(flat));
    });
    Promise.all(promises)
    .then((changedFlats) => {
      console.log(`found ${changedFlats.length} changed flats - ${new Date()}`);
      this.sendMail(changedFlats);
    });
  }

  getDataOfUrls (flat) {
    return new Promise((resolve, reject) => {
      console.log(`crawling ${flat.name} - ${new Date()}`);
      request(flat.url, (error, response, body) => {
        if (error) {
          console.error(e.message);
          return;
        }
        this.parseHtml(body, flat)
        .then((content) => {
          if (content !== flat.lastContent) {
            flat.lastContent = content;
            // notify
            resolve(flat);
          }
        })
        .catch((err) => console.error(err))
      });
    });
  };

  parseHtml (html, flat) {
    return new Promise((resolve, reject) => {
      console.log(`parsing ${flat.name} - ${new Date()}`);
      let $ = cheerio.load(html)
      let content = $(flat.selector).html();
      if (content) {
        resolve(content);
      } else {
        reject(`No content for selector ${flat.selector} found`);
      }
    })
  };

  sendMail (changedFlats) {
    mailOptions.subject = `FlatCrawler - Found ${changedFlats.length} new objects 🏠 🎉`;
    let objects = '';
    changedFlats.forEach((flat) => {
      objects += `
        <li>
          <a href="${flat.url}">${flat.name}</a>
          <hr>
        </li>
      `
    })
    mailOptions.html = `
      <b>FlatCrawler</b>
      <br><br>
      <span> New Objects found on these pages </span>
      <ul>
        ${objects}
      </ul>
      <br><br>
      Greetings 👋 👊
    `;

    console.log(`Sending mail to ${mailOptions.to} - ${new Date()}`);
    // send mail with defined transport object
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        return console.log(error);
      }
      console.log('Message %s sent: %s', info.messageId, info.response);
    });
  }

  scheduler () {
    schedule.scheduleJob('15 12 * * 1', () => {
      console.log(`Scheduler started - ${new Date()}`);
      this.start();
    });
    if (!this.hasRun) {
      this.start();
      this.hasRun = true;
    }
  };
}
new FlatCrawler();
