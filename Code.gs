var SHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();
function doGet(e) {
  var action = e.parameter.action;
  if (action == 'get_users') {
    var sheet = getOrCreateSheet("Users", ["Name", "Pin"]);
    if (sheet.getLastRow() < 2) sheet.getRange(2, 1, 1, 2).setValues([["Admin", "1234"]]);
    var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
    return ContentService.createTextOutput(JSON.stringify(data.map(r => r[0]).filter(n => n))).setMimeType(ContentService.MimeType.JSON);
  }
  if (action == 'get_menu') {
    var sheet = getOrCreateSheet("Menu", ["Category", "ID", "Name", "Price", "Cost", "Milk_Option", "Oat_Price", "Image_URL"]);
    if (sheet.getLastRow() < 2) return ContentService.createTextOutput(JSON.stringify([])).setMimeType(ContentService.MimeType.JSON);
    var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 8).getValues();
    var menu = [];
    for (var i = 0; i < data.length; i++) {
      if (data[i][2]) {
        menu.push({
          category: data[i][0], id: data[i][1], name: data[i][2], price: data[i][3], cost: data[i][4],
          hasMilk: data[i][5] === "Yes", oatPrice: data[i][6], image: data[i][7]
        });
      }
    }
    return ContentService.createTextOutput(JSON.stringify(menu)).setMimeType(ContentService.MimeType.JSON);
  }
  if (action == 'get_history') {
    var monthParam = e.parameter.month;
    var monthSheetName = monthParam || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "MMM_yyyy");
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName(monthSheetName);
    if (!sheet || sheet.getLastRow() < 2) return ContentService.createTextOutput(JSON.stringify([])).setMimeType(ContentService.MimeType.JSON);
    var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 7).getValues();
    var history = [];
    var MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    for (var i = 0; i < data.length; i++) {
      if (data[i][0] === "TOTALS") continue;
      var idStr = String(data[i][0]);
      var dateStr;
      // Derive date from Order ID (YYYYMMDD-NNN) — immune to sheet locale/format bugs
      if (/^\d{8}-\d{3}$/.test(idStr)) {
        var yyyy = idStr.substr(0, 4);
        var mm   = parseInt(idStr.substr(4, 2));
        var dd   = idStr.substr(6, 2);
        dateStr  = dd + '-' + MONTHS_SHORT[mm - 1] + '-' + yyyy;
      } else {
        var dateVal = data[i][1];
        dateStr = (dateVal instanceof Date)
            ? Utilities.formatDate(dateVal, Session.getScriptTimeZone(), "dd-MMM-yyyy")
            : String(dateVal);
      }
      var timeVal = data[i][2];
      var timeStr = (timeVal instanceof Date)
          ? Utilities.formatDate(timeVal, Session.getScriptTimeZone(), "HH:mm:ss")
          : String(timeVal);
      history.push({ id: data[i][0], date: dateStr, time: timeStr, name: data[i][4], price: data[i][5], cost: data[i][6] });
    }
    return ContentService.createTextOutput(JSON.stringify(history.reverse())).setMimeType(ContentService.MimeType.JSON);
  }
  if (action == 'get_inventory') {
    var monthParam = e.parameter.month;
    var monthSheetName = (monthParam || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "MMM_yyyy")) + "_Inv";
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName(monthSheetName);
    if (!sheet || sheet.getLastRow() < 2) return ContentService.createTextOutput(JSON.stringify([])).setMimeType(ContentService.MimeType.JSON);

    var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 6).getValues();
    var displayValues = sheet.getRange(2, 1, sheet.getLastRow() - 1, 6).getDisplayValues();

    var inv = [];
    for (var i = 0; i < values.length; i++) {
      if (values[i][0] === "TOTALS") continue;
      inv.push({
          date: displayValues[i][0],
          time: displayValues[i][1],
          user: displayValues[i][2],
          item: displayValues[i][3],
          qty: displayValues[i][4],
          cost: values[i][5]
      });
    }
    return ContentService.createTextOutput(JSON.stringify(inv.reverse())).setMimeType(ContentService.MimeType.JSON);
  }
  if (action == 'get_all_time_stats') {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheets = ss.getSheets();
    var totalSales = 0;
    var totalInvCost = 0;
    for (var i = 0; i < sheets.length; i++) {
      var sheet = sheets[i];
      var sheetName = sheet.getName();

      var isInv = sheetName.endsWith("_Inv");
      var isSales = /^[A-Z][a-z]{2}_\d{4}$/.test(sheetName);
      if (!isInv && !isSales) continue;
      var lastRow = sheet.getLastRow();
      if (lastRow < 2) continue;
      var lastRowTotal = parseFloat(sheet.getRange(lastRow, 6).getValue()) || 0;

      if (isInv) {
        totalInvCost += lastRowTotal;
      } else {
        totalSales += lastRowTotal;
      }
    }
    return ContentService.createTextOutput(JSON.stringify({ sales: totalSales, cost: totalInvCost })).setMimeType(ContentService.MimeType.JSON);
  }
}
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    if (data.action === 'login') {
      var sheet = getOrCreateSheet("Users", ["Name", "Pin"]);
      var lastRow = sheet.getLastRow();
      if (lastRow < 2) {
          return ContentService.createTextOutput(JSON.stringify({"status": "error", "message": "No users found in sheet"})).setMimeType(ContentService.MimeType.JSON);
      }
      var users = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
      for (var i = 0; i < users.length; i++) {
        if (String(users[i][0]).trim() === String(data.user).trim() && String(users[i][1]).trim() === String(data.pin).trim()) {
          return ContentService.createTextOutput(JSON.stringify({"status": "success"})).setMimeType(ContentService.MimeType.JSON);
        }
      }
      return ContentService.createTextOutput(JSON.stringify({"status": "error", "message": "Incorrect PIN"})).setMimeType(ContentService.MimeType.JSON);
    }
    if (data.action === 'save_inventory') {
      var monthSheetName = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "MMM_yyyy") + "_Inv";
      var sheet = getOrCreateSheet(monthSheetName, ["Date", "Time", "User", "Item", "Quantity", "Cost"]);

      var lastRow = sheet.getLastRow();
      if (lastRow > 1 && sheet.getRange(lastRow, 1).getValue() === "TOTALS") sheet.deleteRow(lastRow);
      var time = new Date().toLocaleTimeString('en-GB');
      var date = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd-MMM-yyyy");

      if (data.items && data.items.length > 0) {
        var newRows = [];
        data.items.forEach(function(i) {
          newRows.push([date, time, data.user, i.item, i.qty, i.cost]);
        });
        sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, 6).setValues(newRows);
      }
      var finalRow = sheet.getLastRow() + 1;
      var lastDataRow = finalRow - 1;
      sheet.getRange(finalRow, 1).setValue("TOTALS").setFontWeight("bold");
      sheet.getRange(finalRow, 6).setFormula("=SUM(F2:F" + lastDataRow + ")").setFontWeight("bold");
      return ContentService.createTextOutput(JSON.stringify({"status": "success"})).setMimeType(ContentService.MimeType.JSON);
    }
    if (data.action === 'edit_inventory') {
      var monthSheetName = (data.month || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "MMM_yyyy")) + "_Inv";
      var sheet = getOrCreateSheet(monthSheetName, ["Date", "Time", "User", "Item", "Quantity", "Cost"]);
      var displayValues = sheet.getDataRange().getDisplayValues();
      for (var i = 1; i < displayValues.length; i++) {
        if (displayValues[i][0] == data.old_date && displayValues[i][1] == data.old_time && displayValues[i][3] == data.old_item) {
          sheet.getRange(i + 1, 4, 1, 3).setValues([[data.new_item, data.new_qty, data.new_cost]]);
          var lastRow = sheet.getLastRow();
          if (lastRow > 1 && sheet.getRange(lastRow, 1).getValue() === "TOTALS") {
              sheet.getRange(lastRow, 6).setFormula("=SUM(F2:F" + (lastRow - 1) + ")");
          }
          break;
        }
      }
      return ContentService.createTextOutput(JSON.stringify({"status": "success"})).setMimeType(ContentService.MimeType.JSON);
    }
    if (data.action === 'delete_inventory') {
      var monthSheetName = (data.month || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "MMM_yyyy")) + "_Inv";
      var sheet = getOrCreateSheet(monthSheetName, ["Date", "Time", "User", "Item", "Quantity", "Cost"]);
      var displayValues = sheet.getDataRange().getDisplayValues();
      for (var i = 1; i < displayValues.length; i++) {
        if (displayValues[i][0] == data.date && displayValues[i][1] == data.time && displayValues[i][3] == data.item) {
          sheet.deleteRow(i + 1);
          var lastRow = sheet.getLastRow();
          if (lastRow > 1 && sheet.getRange(lastRow, 1).getValue() === "TOTALS") {
              if (lastRow === 2) sheet.getRange(lastRow, 6).setValue(0);
              else sheet.getRange(lastRow, 6).setFormula("=SUM(F2:F" + (lastRow - 1) + ")");
          }
          break;
        }
      }
      return ContentService.createTextOutput(JSON.stringify({"status": "success"})).setMimeType(ContentService.MimeType.JSON);
    }
    if (data.action === 'save_item') {
      var sheet = getOrCreateSheet("Menu", ["Category", "ID", "Name", "Price", "Cost", "Milk_Option", "Oat_Price", "Image_URL"]);
      var values = sheet.getDataRange().getValues();
      var rowIndex = -1;
      for (var i = 1; i < values.length; i++) {
        if (String(values[i][1]) == String(data.id)) { rowIndex = i + 1; break; }
      }
      var rowData = [data.category, data.id, data.name, data.price, data.cost, data.hasMilk ? "Yes" : "No", data.oatPrice, data.image];
      if (rowIndex > 0) sheet.getRange(rowIndex, 1, 1, 8).setValues([rowData]);
      else sheet.appendRow(rowData);
      return ContentService.createTextOutput(JSON.stringify({"status": "success"})).setMimeType(ContentService.MimeType.JSON);
    }
    if (data.action === 'delete_item') {
      var sheet = getOrCreateSheet("Menu", ["Category", "ID", "Name", "Price", "Cost", "Milk_Option", "Oat_Price", "Image_URL"]);
      var values = sheet.getDataRange().getValues();
      for (var i = 1; i < values.length; i++) {
        if (String(values[i][1]) == String(data.id)) {
          sheet.deleteRow(i + 1);
          return ContentService.createTextOutput(JSON.stringify({"status": "success"})).setMimeType(ContentService.MimeType.JSON);
        }
      }
      return ContentService.createTextOutput(JSON.stringify({"status": "error", "message": "ID not found"})).setMimeType(ContentService.MimeType.JSON);
    }

    if (data.action === 'delete_order') {
      var ss = SpreadsheetApp.openById(SHEET_ID);
      var sheet = ss.getSheetByName(data.month);
      if (!sheet) return ContentService.createTextOutput(JSON.stringify({"status":"error","message":"Sheet not found"})).setMimeType(ContentService.MimeType.JSON);
      var values = sheet.getDataRange().getValues();
      // Delete matching rows bottom-up so row indices stay valid
      for (var i = values.length - 1; i >= 1; i--) {
        if (String(values[i][0]) === String(data.order_id)) sheet.deleteRow(i + 1);
      }
      // Rebuild TOTALS
      var lastRow = sheet.getLastRow();
      if (lastRow > 1 && sheet.getRange(lastRow, 1).getValue() === "TOTALS") sheet.deleteRow(lastRow);
      var newLast = sheet.getLastRow();
      if (newLast >= 2) {
        var finalRow = newLast + 1;
        sheet.getRange(finalRow, 1).setValue("TOTALS").setFontWeight("bold");
        sheet.getRange(finalRow, 6).setFormula("=SUM(F2:F" + newLast + ")").setFontWeight("bold");
        sheet.getRange(finalRow, 7).setFormula("=SUM(G2:G" + newLast + ")").setFontWeight("bold");
        sheet.getRange(finalRow, 8).setFormula("=SUM(H2:H" + newLast + ")").setFontWeight("bold");
        sheet.getRange(finalRow, 9).setFormula("=SUM(I2:I" + newLast + ")").setFontWeight("bold");
      }
      return ContentService.createTextOutput(JSON.stringify({"status":"success"})).setMimeType(ContentService.MimeType.JSON);
    }
    if (data.action === 'delete_order_item') {
      var ss = SpreadsheetApp.openById(SHEET_ID);
      var sheet = ss.getSheetByName(data.month);
      if (!sheet) return ContentService.createTextOutput(JSON.stringify({"status":"error","message":"Sheet not found"})).setMimeType(ContentService.MimeType.JSON);
      var values = sheet.getDataRange().getValues();
      for (var i = 1; i < values.length; i++) {
        if (String(values[i][0]) === String(data.order_id) && String(values[i][4]) === String(data.item_name)) {
          sheet.deleteRow(i + 1);
          var lastRow = sheet.getLastRow();
          if (lastRow > 1 && sheet.getRange(lastRow, 1).getValue() === "TOTALS") {
            var dataEnd = lastRow - 1;
            if (dataEnd < 2) {
              sheet.getRange(lastRow, 6).setValue(0); sheet.getRange(lastRow, 7).setValue(0);
              sheet.getRange(lastRow, 8).setValue(0); sheet.getRange(lastRow, 9).setValue(0);
            } else {
              sheet.getRange(lastRow, 6).setFormula("=SUM(F2:F" + dataEnd + ")");
              sheet.getRange(lastRow, 7).setFormula("=SUM(G2:G" + dataEnd + ")");
              sheet.getRange(lastRow, 8).setFormula("=SUM(H2:H" + dataEnd + ")");
              sheet.getRange(lastRow, 9).setFormula("=SUM(I2:I" + dataEnd + ")");
            }
          }
          break;
        }
      }
      return ContentService.createTextOutput(JSON.stringify({"status":"success"})).setMimeType(ContentService.MimeType.JSON);
    }
    // --- ORDER SAVING: use orderDate from app if provided, otherwise use current date ---
    var targetDate;
    if (data.orderDate) {
      var parts = data.orderDate.split('-');
      targetDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    } else {
      targetDate = new Date();
    }
    var monthSheetName = Utilities.formatDate(targetDate, Session.getScriptTimeZone(), "MMM_yyyy");
    var sheet = getOrCreateSheet(monthSheetName, ["ID", "Date", "Time", "Staff", "Item", "Price", "Cost", "Qty", "Profit"]);
    var lastRow = sheet.getLastRow();
    if (lastRow > 1 && sheet.getRange(lastRow, 1).getValue() === "TOTALS") sheet.deleteRow(lastRow);
    if (data.action === 'clear_all') {
      if (sheet.getLastRow() > 1) sheet.getRange(2, 1, sheet.getLastRow()-1, 9).clearContent();
      return ContentService.createTextOutput(JSON.stringify({"status": "cleared"})).setMimeType(ContentService.MimeType.JSON);
    }
    var time = new Date().toLocaleTimeString('en-GB');
    var date = Utilities.formatDate(targetDate, Session.getScriptTimeZone(), "dd-MMM-yyyy");
    var newRows = [];
    data.items.forEach(function(item) {
      newRows.push([item.id, date, time, data.user, item.name, item.price, item.cost, 1, item.price - item.cost]);
    });

    if (newRows.length > 0) sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, 9).setValues(newRows);
    var finalRow = sheet.getLastRow() + 1;
    var lastDataRow = finalRow - 1;
    sheet.getRange(finalRow, 1).setValue("TOTALS").setFontWeight("bold");
    sheet.getRange(finalRow, 6).setFormula("=SUM(F2:F" + lastDataRow + ")").setFontWeight("bold");
    sheet.getRange(finalRow, 7).setFormula("=SUM(G2:G" + lastDataRow + ")").setFontWeight("bold");
    sheet.getRange(finalRow, 8).setFormula("=SUM(H2:H" + lastDataRow + ")").setFontWeight("bold");
    sheet.getRange(finalRow, 9).setFormula("=SUM(I2:I" + lastDataRow + ")").setFontWeight("bold");
    return ContentService.createTextOutput(JSON.stringify({"status": "success"})).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({"status": "error", "message": err.toString()})).setMimeType(ContentService.MimeType.JSON);
  }
}
function getOrCreateSheet(name, headers) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(name);
  if (!sheet) { sheet = ss.insertSheet(name); sheet.getRange(1, 1, 1, headers.length).setValues([headers]); }
  return sheet;
}

// ============================================================
// TELEGRAM DAILY REPORT — My Day Matcha
// ============================================================
// Store secrets in: Apps Script > Project Settings > Script Properties
// Add: TELEGRAM_TOKEN = <your bot token>  |  TELEGRAM_CHAT_ID = <your chat id>
var TELEGRAM_TOKEN   = PropertiesService.getScriptProperties().getProperty('TELEGRAM_TOKEN');
var TELEGRAM_CHAT_ID = PropertiesService.getScriptProperties().getProperty('TELEGRAM_CHAT_ID');
var REPORT_TZ        = 'Asia/Bangkok'; // UTC+7 — same as Phnom Penh / Cambodia

// Send an HTML-formatted message to Telegram
function sendTelegram_(msg) {
  var url = 'https://api.telegram.org/bot' + TELEGRAM_TOKEN + '/sendMessage';
  UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    muteHttpExceptions: true,
    payload: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: msg, parse_mode: 'HTML' })
  });
}

// Format a number as KHR with comma separators (no decimals)
function fmtKHR_(n) {
  var s = Math.round(n || 0).toString();
  var result = '';
  for (var i = s.length - 1, c = 0; i >= 0; i--, c++) {
    if (c > 0 && c % 3 === 0) result = ',' + result;
    result = s[i] + result;
  }
  return result + ' KHR';
}

// Fetch orders for a specific date string 'dd-MMM-yyyy'
// filter: 'on_time' (recorded ≤ 19:30), 'late' (recorded > 19:30)
function getDayOrders_(dateStr, filter) {
  var parts     = dateStr.split('-');           // ['08', 'Mar', '2026']
  var sheetName = parts[1] + '_' + parts[2];   // 'Mar_2026'
  var ss        = SpreadsheetApp.openById(SHEET_ID);
  var sheet     = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return [];

  var MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var rows   = sheet.getRange(2, 1, sheet.getLastRow() - 1, 9).getValues();
  var cutoff = 19 * 60 + 30; // 19:30 in minutes since midnight
  var result = [];

  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (!r[0] || r[0] === 'TOTALS') continue;

    // Resolve row date — prefer Order ID (YYYYMMDD-NNN) for reliability
    var idStr = String(r[0]);
    var rowDate;
    if (/^\d{8}-\d{3}$/.test(idStr)) {
      var yr = idStr.substr(0, 4);
      var mo = parseInt(idStr.substr(4, 2));
      var dd = idStr.substr(6, 2);
      rowDate = dd + '-' + MONTHS[mo - 1] + '-' + yr;
    } else {
      rowDate = (r[1] instanceof Date)
        ? Utilities.formatDate(r[1], REPORT_TZ, 'dd-MMM-yyyy')
        : String(r[1]);
    }
    if (rowDate !== dateStr) continue;

    // Resolve time — stored as 'HH:mm:ss' string or a Date serial
    var rawTime = r[2];
    var timeStr = (rawTime instanceof Date)
      ? Utilities.formatDate(rawTime, REPORT_TZ, 'HH:mm:ss')
      : String(rawTime);
    var tp      = timeStr.split(':');
    var rowMins = (parseInt(tp[0]) || 0) * 60 + (parseInt(tp[1]) || 0);
    var isLate  = rowMins > cutoff;

    if (filter === 'on_time' && isLate)  continue;
    if (filter === 'late'    && !isLate) continue;

    result.push({ price: parseFloat(r[5]) || 0, cost: parseFloat(r[6]) || 0, profit: parseFloat(r[8]) || 0 });
  }
  return result;
}

// Sum orders into report stats
function sumOrders_(orders) {
  var s = { drinks: orders.length, income: 0, cost: 0, profit: 0 };
  orders.forEach(function(o) { s.income += o.price; s.cost += o.cost; s.profit += o.profit; });
  return s;
}

// ── Triggered at 7:30 PM — sends today's daily report ───────
function sendDailyReport() {
  var today  = Utilities.formatDate(new Date(), REPORT_TZ, 'dd-MMM-yyyy');
  var orders = getDayOrders_(today, 'on_time');
  var msg;

  if (orders.length === 0) {
    msg = "🍵 Looks like we're on a day off today, Goodnight. 🌙";
  } else {
    var s = sumOrders_(orders);
    msg = "🍵 <b>Sell day</b>\n\n"
        + "Goodnight My Beautiful owner 🌙\n"
        + "Here is your report of the day,\n\n"
        + "📅 <b>Date:</b> " + today + "\n"
        + "🧋 <b>Drinks sell:</b> " + s.drinks + " cups\n"
        + "💰 <b>Income:</b> " + fmtKHR_(s.income) + "\n"
        + "📦 <b>Cost:</b> " + fmtKHR_(s.cost) + "\n"
        + "✨ <b>Profit:</b> " + fmtKHR_(s.profit) + "\n\n"
        + "<i>⚠️ Note: Day's Net Profit is NOT Monthly Actual Profit</i>";
  }
  sendTelegram_(msg);
}

// ── Triggered at 6:00 AM — sends late-order report for yesterday ──
function sendLateReport() {
  var yesterday = new Date(new Date().getTime() - 24 * 60 * 60 * 1000);
  var yStr      = Utilities.formatDate(yesterday, REPORT_TZ, 'dd-MMM-yyyy');
  var orders    = getDayOrders_(yStr, 'late');
  if (orders.length === 0) return; // Nothing to report — stay quiet

  var s   = sumOrders_(orders);
  var msg = "⏰ <b>Looks like someone forgot to do Homework.</b>\n\n"
          + "Here is your late report of the day,\n\n"
          + "📅 <b>Date:</b> " + yStr + "\n"
          + "🧋 <b>Drinks sell:</b> " + s.drinks + " cups\n"
          + "💰 <b>Income:</b> " + fmtKHR_(s.income) + "\n"
          + "📦 <b>Cost:</b> " + fmtKHR_(s.cost) + "\n"
          + "✨ <b>Profit:</b> " + fmtKHR_(s.profit) + "\n\n"
          + "<i>⚠️ Note: Day's Net Profit is NOT Monthly Actual Profit</i>";
  sendTelegram_(msg);
}

// ── Run ONCE manually from the Apps Script editor ────────────
// Opens: Extensions → Apps Script → select createDailyTriggers → Run
function createDailyTriggers() {
  // Remove any existing triggers for these functions to avoid duplicates
  ScriptApp.getProjectTriggers().forEach(function(t) {
    var fn = t.getHandlerFunction();
    if (fn === 'sendDailyReport' || fn === 'sendLateReport') ScriptApp.deleteTrigger(t);
  });
  // 7:30 PM Phnom Penh time (UTC+7)
  ScriptApp.newTrigger('sendDailyReport')
    .timeBased().atHour(19).nearMinute(30).everyDays(1).inTimezone(REPORT_TZ).create();
  // 6:00 AM Phnom Penh time (UTC+7)
  ScriptApp.newTrigger('sendLateReport')
    .timeBased().atHour(6).nearMinute(0).everyDays(1).inTimezone(REPORT_TZ).create();
  Logger.log('Triggers created: sendDailyReport @ 19:30 and sendLateReport @ 06:00 (Asia/Bangkok / Phnom Penh)');
}
