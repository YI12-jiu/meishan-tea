window.TeaStore = (function () {
  var KEY = "meishan-tea:local-cellar:v1";
  function valid(rows) {
    if (!Array.isArray(rows) || rows.length > 1000)
      throw new Error("记录格式不正确，或超过 1000 条。");
    var ids = new Set();
    return rows.map(function (r) {
      if (
        !r ||
        typeof r.id !== "string" ||
        !r.id ||
        ids.has(r.id) ||
        !["tea", "note"].includes(r.kind) ||
        typeof r.name !== "string" ||
        !r.name.trim()
      )
        throw new Error("记录缺少必要字段或编号重复。");
      ids.add(r.id);
      var out = { id: r.id, kind: r.kind };
      [
        "name",
        "type",
        "vintage",
        "quantity",
        "storage",
        "note",
        "updatedAt",
      ].forEach(function (k) {
        if (r[k] != null && typeof r[k] !== "string")
          throw new Error("记录字段格式不正确。");
        out[k] = r[k] || "";
        if (out[k].length > (k === "note" ? 5000 : 300))
          throw new Error("记录内容过长。");
      });
      if (out.updatedAt && isNaN(Date.parse(out.updatedAt)))
        throw new Error("记录日期无效。");
      return out;
    });
  }
  function read() {
    var raw;
    try {
      raw = localStorage.getItem(KEY);
    } catch (e) {
      throw new Error("浏览器不允许读取本机存储，请检查隐私设置。");
    }
    if (!raw) return [];
    try {
      var data = JSON.parse(raw);
      if (data.version !== 1) throw new Error();
      return valid(data.records);
    } catch (e) {
      throw new Error(
        "本机记录无法读取。原数据未被覆盖，请先导出原始备份再处理。",
      );
    }
  }
  function write(records) {
    var checked = valid(records);
    try {
      localStorage.setItem(
        KEY,
        JSON.stringify({ version: 1, records: checked }),
      );
    } catch (e) {
      throw new Error(
        "未能保存：浏览器存储不可用或空间不足。请保留输入内容，检查隐私设置后重试。",
      );
    }
    return checked;
  }
  function save(record) {
    var records = read(),
      i = records.findIndex(function (r) {
        return r.id === record.id;
      });
    if (i >= 0) records[i] = record;
    else records.unshift(record);
    return write(records);
  }
  function remove(id) {
    return write(
      read().filter(function (r) {
        return r.id !== id;
      }),
    );
  }
  function importData(text) {
    var data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      throw new Error("请选择导出的 JSON 备份文件。");
    }
    if (!data || data.app !== "meishan-tea" || data.version !== 1)
      throw new Error("这不是梅山茶脉的 v1 备份文件。");
    var incoming = valid(data.records),
      existing = read(),
      ids = new Set(
        existing.map(function (r) {
          return r.id;
        }),
      );
    var additions = incoming.filter(function (r) {
      return !ids.has(r.id);
    });
    write(additions.concat(existing));
    return additions.length;
  }
  return {
    read: read,
    save: save,
    remove: remove,
    importData: importData,
    exportData: function () {
      return JSON.stringify(
        {
          app: "meishan-tea",
          version: 1,
          exportedAt: new Date().toISOString(),
          records: read(),
        },
        null,
        2,
      );
    },
    raw: function () {
      return localStorage.getItem(KEY) || "";
    },
  };
})();
