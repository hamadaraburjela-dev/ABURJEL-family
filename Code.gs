/**
 // Code.gs - نسخة مُبسطة بدون عداد الزوار
*/

const COLS = {
  TIMESTAMP: 1,
  FULLNAME: 2,
  PHONE: 3,
  YEAR: 4,
  SCORE: 5,
  UNIQUE_ID: 6
};

// خزّن ID الشيت في Script Properties بدلاً من الكود الثابت إن أمكن
const SPREADSHEET_ID = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID') 
  || '1QVkXMhQ2OyI2SQFu8kt6I6YxmWNuLDwTyAnE63RJq-8';
const SHEET_NAME = 'Sheet1';
const CACHE_PREFIX = 'id_'; // prefix لمفاتيح الكاش
const CACHE_TTL = 60 * 60 * 6; // 6 ساعات

function doPost(e) {
  var locked = false;
  var lock = LockService.getScriptLock();
  try {
    // التحقق من المفتاح API_KEY
    var API_KEY = PropertiesService.getScriptProperties().getProperty('API_KEY');
    if (API_KEY) {
      var provided = (e.parameter && e.parameter.apiKey) ? e.parameter.apiKey : '';
      if (provided !== API_KEY) {
        return createErrorOutput('Unauthorized: invalid apiKey', 401);
      }
    }

    // محاولة الحصول على القفل (10 ثواني)
    locked = lock.tryLock(10000);
    if (!locked) {
      return createJson({ result: 'retry', message: 'Server busy, please retry after a short delay.' });
    }

    var action = e.parameter && e.parameter.action;

    // فتح الشيت
    var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
    if (!sheet) throw new Error('Sheet not found: ' + SHEET_NAME);

    if (action == "register") {
      return registerUser(e, sheet);
    } else if (action == "updateScore") {
      return updateScore(e, sheet);
    } else {
      throw new Error("Action not specified or invalid.");
    }
  } catch (error) {
    return createErrorOutput(error.toString());
  } finally {
    if (locked) {
      try { lock.releaseLock(); } catch (err) {}
    }
  }
}

// -------- أدوات مساعدة --------
function createJson(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
function createErrorOutput(message, code) {
  return createJson({ result: 'error', message: message, code: code || 400 });
}

// -------- تسجيل مستخدم --------
function registerUser(e, sheet) {
  var name = e.parameter.name || '';
  var phone = e.parameter.phone || '';
  var year = e.parameter.year || '';
  var uniqueId = Utilities.getUuid();
  var timestamp = new Date();

  // Append row
  sheet.appendRow([timestamp, name, phone, year, '', uniqueId]);

  var lastRow = sheet.getLastRow();

  // تخزين الصف في الكاش
  try {
    CacheService.getScriptCache().put(CACHE_PREFIX + uniqueId, String(lastRow), CACHE_TTL);
  } catch (e) {}

  return createJson({ result: 'success', uniqueId: uniqueId, row: lastRow });
}

// -------- تحديث النتيجة --------
function updateScore(e, sheet) {
  var uniqueId = e.parameter.uniqueId;
  var score = e.parameter.score;

  if (!uniqueId) {
    return createErrorOutput("Unique ID is required to update score.");
  }

  var cache = CacheService.getScriptCache();
  var targetRow = -1;

  // محاولة من الكاش
  try {
    var cached = cache.get(CACHE_PREFIX + uniqueId);
    if (cached) {
      var r = parseInt(cached, 10);
      if (!isNaN(r) && r > 1) {
        var val = sheet.getRange(r, COLS.UNIQUE_ID).getValue();
        if (val == uniqueId) {
          targetRow = r;
        } else {
          cache.remove(CACHE_PREFIX + uniqueId);
        }
      }
    }
  } catch (err) {}

  // fallback: البحث في العمود
  if (targetRow == -1) {
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return createErrorOutput("No users in sheet.");
    }
    var idColumnValues = sheet.getRange(2, COLS.UNIQUE_ID, lastRow - 1, 1).getValues();
    for (var i = 0; i < idColumnValues.length; i++) {
      if (idColumnValues[i][0] == uniqueId) {
        targetRow = i + 2;
        try {
          cache.put(CACHE_PREFIX + uniqueId, String(targetRow), CACHE_TTL);
        } catch (err) {}
        break;
      }
    }
  }

  if (targetRow != -1) {
    sheet.getRange(targetRow, COLS.SCORE).setValue(score);
    return createJson({ result: 'success', message: 'Score updated.', row: targetRow });
  } else {
    return createErrorOutput("User with the specified Unique ID was not found.", 404);
  }
}
