-- GĐ3c phần 2: token OpenAI mỗi lần quét và lý do chuyển sang chế độ dự phòng.
ALTER TABLE "ReceiptScan" ADD COLUMN "inputTokens" INTEGER,
ADD COLUMN "outputTokens" INTEGER,
ADD COLUMN "fallbackCode" TEXT;
