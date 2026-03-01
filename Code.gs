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
    var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 6).getValues();
    var history = [];
    for (var i = 0; i < data.length; i++) {
      if (data[i][0] === "TOTALS") continue;
      var dateVal = data[i][1];
      var dateStr = (dateVal instanceof Date)
          ? Utilities.formatDate(dateVal, Session.getScriptTimeZone(), "dd-MMM-yyyy")
          : String(dateVal);
      var timeVal = data[i][2];
      var timeStr = (timeVal instanceof Date)
          ? Utilities.formatDate(timeVal, Session.getScriptTimeZone(), "HH:mm:ss")
          : String(timeVal);
      history.push({ id: data[i][0], date: dateStr, time: timeStr, name: data[i][4], price: data[i][5] });
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
