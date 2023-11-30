import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

import puppeteer from 'puppeteer';

import { parse } from 'node-xlsx';

import config from './.puppeteerrc.cjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const excelData = readData(resolve(__dirname, 'data.xlsx'));
const parsedRows = parseExcelData(excelData[0].data);

// #region
const password = 'P@$$w0rd@1234';
// #endregion

(async () => {

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: [
      '--start-maximized' // you can also use '--start-fullscreen'
    ]
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(config.project.waitTimeout);

  await page.goto('https://wd3.myworkday.com/aristocrat/d/home.htmld');

  await page.waitForSelector('[name=identifier]');

  // Set screen size
  await page.setViewport({ width: 1740, height: 1080 });

  // Type into search box
  // await page.type('[name=username]', 'gaurav.mahto2@anaxi.com');
  await page.type('[name=identifier]', 'gaurav.mahto2@anaxi.com');

  // await page.click('#idp-discovery-submit');
  await page.click('[value="Next"]');

  // await page.waitForSelector('#okta-signin-password');
  await page.waitForSelector('[name="credentials.passcode"]');
  // await page.type('#okta-signin-password', password);
  await page.type('[name="credentials.passcode"]', password);

  // await page.click('#okta-signin-submit');
  await page.click('[value="Verify"]');

  // await waitAndClick(page, '[value="Send Push"]');
  await waitAndClick(page, '[data-se="okta_verify-push"] a');

  // await waitAndClick(page, '[data-uxi-element-id="app-header-inbox-button"]');
  await waitAndClick(page, '[data-automation-id="globalNavButton"]');
  await waitForElement(page, '[data-automation-id="globalNav"][aria-hidden="false"]');
  await waitFor(1500);
  // await waitForInnerText(page, '[aria-label="Talent and Performance"] [data-automation-id="globalNavAppItemLabel"] span span span', 'Talent and Performance');
  await waitAndClick(page, 'a[aria-label="Talent and Performance"]');
  await waitFor(1500);
  await waitAndClick(page, '[title="My Individual Goals"]');
  await waitFor(1500);

  const excelData = readData(resolve(__dirname, 'data.xlsx'));
  const [headers, parsedRows] = parseExcelData(excelData[0].data);

  await setDataOnUi(page, headers, parsedRows);

  // await browser.close();

})();

async function waitForElement(page, selector, options) {

  await page.waitForSelector(selector, options);

}

async function waitAndType(page, selector, text) {

  await waitForElement(page, selector);

  await page.type(selector, text);

}

async function waitAndSetText(page, selector, text) {

  await waitForElement(page, selector);

  await page.evaluate((selector, text) => document.querySelector(selector).innerText = text, selector, text);

}

async function getInnerText(page, selector) {

  return await page.evaluate(selector => document.querySelector(selector)?.innerText, selector);

}

async function waitAndClick(page, selector, options) {

  await waitForElement(page, selector, options);
  await page.click(selector);

}

async function waitForInnerText(page, selector, text) {

  await page.waitForFunction(_ => document.querySelector(selector)?.textContent === text);

}

// Get total count of element
async function getTotalCountOf(page, selector) {

  return (await page.$$(selector)).length;

}

async function addNewRowItem(page) {

  await waitForElement(page, '[data-automation-id="multiViewContainerAddButton"]');

  await waitForDataLoaderToBeHidden(page, '[data-automation-id="glassPanel"]');

  const countOfLis = await getTotalCountOf(page, 'ul[data-automation-id="menuList"] li [data-automation-id="multiViewPrimaryHeader"]');

  console.log(`Total record count is ${countOfLis}`);

  await waitAndClick(page, '[data-automation-id="multiViewContainerAddButton"]');

  await page.waitForFunction(_ =>

    document.querySelector('[data-automation-id="menuList"] li:first-child [data-automation-id="multiViewPrimaryHeader"]')?.textContent === ''

  );

  await page.waitForNetworkIdle();

  console.log('After click of add main row, total record count is ',
    await getTotalCountOf(page, 'ul[data-automation-id="menuList"] li [data-automation-id="multiViewPrimaryHeader"]'));

  await waitForDataLoaderToBeHidden(page, '[data-automation-id="glassPanel"]');

}

// -----

async function setDataOnUi(page, headers, parsedRows) {

  for (const row in parsedRows) {

    await addNewRowItem(page);

    await waitAndType(page, '[data-automation-id="inlineRowEditPage"] [data-automation-id="richTextContent"]', row);

    await page.click('[data-automation-id="selectShowAll"]');

    await waitFor(1500);

    await waitForElement(page, '[data-automation-id="selectWidget-SuggestionPopup"]');

    const menuItemSelector = `[data-automation-id="menuList"] [data-automation-id="menuItem"] [data-automation-id="promptOption"][data-automation-label="${'In Progress'}"]`;

    await waitAndClick(page, menuItemSelector);

    // Sort the object based on Due date
    parsedRows[row].sort((a, b) => (new Date(a['Due Date'])).getTime() - (new Date(b['Due Date'])).getTime());

    await setDateOnUi(page, parsedRows[row][0]['Due Date'], 'Due Date');

    let rowCount = 0;

    for (const dataRow of parsedRows[row]) {

      const rowId = await addDataRow(page, ++rowCount);

      // Simulate delay
      await waitFor(1500);

      console.log('--> Adding row', dataRow);

      await addRowEntries(page, rowId, dataRow);

      // Simulate delay
      await waitFor(2000);

    }

  }

  // Save for later
  await waitAndClick('button[data-automation-id="wd-CommandButton_934$14_BPF_Button_Bar"][title="Save for Later"]');
  await waitForElement('[data-automation-id="bpSlimConclusionContainer"]');

}

async function clickDatePickerForLabel(page, label, parentSelector) {

  if (typeof label !== 'undefined') {

    await page.evaluate(label => document.evaluate(
      `//label[@data-automation-id='formLabel'][contains(., '${label}')]`,
      document,
      null,
      XPathResult.ORDERED_NODE_SNAPSHOT_TYPE)?.
      snapshotItem(0)?.
      parentElement?.
      nextElementSibling?.
      querySelector('[data-automation-id="datePickerButton"]')?.
      click(), label);

  } else if (typeof parentSelector !== 'undefined') {

    await page.evaluate(parentSelector => document.querySelector(`${parentSelector} [data-automation-id="datePickerButton"]`)?.click(), parentSelector);

  }

}

async function setDateOnUi(page, date, labelText, parentSelector) {

  await clickDatePickerForLabel(page, labelText, parentSelector);

  await waitForElement(page, '[data-automation-widget="wd-popup"]');

  const dateFormatOptionA = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric'
  });

  const dateFormatOptionB = new Intl.DateTimeFormat('en-US', {
    month: '2-digit',
    day: '2-digit'
  });


  const datePickerMonthText = dateFormatOptionA.format(date);

  let currentMonthYearText = await getInnerText(page, '[data-automation-id="datePickerMonth"]');
  const currentMonthYearDate = new Date(currentMonthYearText);

  while (datePickerMonthText !== currentMonthYearText) {

    if ((currentMonthYearDate.getMonth() < date.getMonth()) ||
      (currentMonthYearDate.getFullYear() < date.getFullYear())) {

      await page.click('[data-automation-id="nextControl"]');

    } else if ((currentMonthYearDate.getMonth() > date.getMonth()) ||
      (currentMonthYearDate.getFullYear() > date.getFullYear())) {

      await page.click('[data-automation-id="previousControl"]');

    }

    currentMonthYearText = await getInnerText(page, '[data-automation-id="datePickerMonth"]');

  }

  const currentMonthDayDate = dateFormatOptionB.formatToParts(date);
  const monthDay = `${currentMonthDayDate[0].value}${currentMonthDayDate[2].value}`;

  await waitAndClick(page, `[data-uxi-datepicker-mmdd="${monthDay}"]`);

}

async function addDataRow(page, expectedRowCount) {

  await waitAndClick(page, '[data-automation-id="VisibleGrid"] [data-automation-id="MainContainer"] [data-automation-id="addRow"]');

  await page.waitForFunction(expectedRowCount => expectedRowCount === document.querySelectorAll('[data-automation-id="MainTable-0"] .mainTable tbody tr').length,
    {}, expectedRowCount);

  // await waitForElement(page, '[data-automation-id="MainTable-0"] .mainTable tbody tr', {
  //   visibile: true
  // });

  return await page.evaluate(_ => document.querySelector(`[data-automation-id="MainTable-0"] .mainTable tbody tr:first-child`)?.
    attributes?.
    rowid?.
    value);

}

async function addRowEntries(page, newRowId, dataRow) {

  const rowIdSelector = `[rowid="${newRowId}"]`;

  await waitAndType(page, `${rowIdSelector} [data-automation-id="textInputBox"]`, dataRow['Key Results Title']);

  await setDateOnUi(page, dataRow['Due Date'], undefined, rowIdSelector);

  await waitAndClick(page, `${rowIdSelector} [data-automation-id="promptIcon"]`);

  const menuItemSelector = `[data-automation-id="activeListContainer"] [data-automation-id="menuItem"] [data-automation-id="promptOption"][data-automation-label="${dataRow['Status']}"]`;

  await waitAndClick(page, menuItemSelector);

}

async function waitForDataLoaderToBeHidden(page, selector, options = {
  hidden: true
}) {

  await waitForElement(page, selector, options);

}

async function waitFor(timeMs) {

  await new Promise(r => setTimeout(r, timeMs));

}

function readData(filePath) {

  const workSheetsFromFile = parse(filePath, {
    type: 'binary',
    cellDates: true,
    cellNF: false,
    cellText: false
  });

  // console.log(workSheetsFromFile[0].data);

  return workSheetsFromFile;

}

function parseExcelData(rows) {

  const rowHeaders = rows[0];

  const rowsObject = {};

  let goal = '';

  rows.forEach((element, index) => {

    if (0 === index) {

      return;

    }

    const rowItem = {};

    rowHeaders.forEach((header, index) => {

      if (typeof element[0] === 'string' && !(element[0] in rowsObject)) {

        goal = element[0];
        rowsObject[goal] = [];

      }

      if (0 === index) {

        return;

      }

      if (element[index] instanceof Date) {

        // Hack to increment date - to be in sync with excel date
        element[index].setDate(element[index].getDate() + 1);
        rowItem[header] = element[index];

      } else {

        rowItem[header] = element[index];

      }

    });

    rowsObject[goal].push(rowItem);

  });

  // console.log(rowsObject);

  /**
   * ],
  'Ownership and Accountability': [
    {
      Status: 'In Progress',
      'Due Date': 2023-09-30T18:29:50.000Z,
      'Key Results Title': 'Contribute in grooming meetings, understand requirements and provide better estimation for every task.'
    },
   */

  return [rowHeaders, rowsObject];

}
