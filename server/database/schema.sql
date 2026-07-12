-- مخطط قاعدة البيانات (يُنشأ تلقائيًا عند الإقلاع — للمرجع فقط)
CREATE TABLE IF NOT EXISTS kpi_store (
  `key`      VARCHAR(191) NOT NULL PRIMARY KEY,
  `value`    JSON NOT NULL,
  updated_at BIGINT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
