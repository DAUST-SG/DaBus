export const isPaid = (status: string) => {
  const normalized = status.toLowerCase();
  return (
    normalized === "paid" ||
    normalized === "paid_and_blocked" ||
    normalized === "completed" ||
    normalized === "success" ||
    normalized === "successful" ||
    normalized === "succeeded" ||
    normalized === "done" ||
    normalized === "approved"
  );
};

export const isFailed = (status: string) => {
  const normalized = status.toLowerCase();
  return (
    normalized === "failed" ||
    normalized === "cancelled" ||
    normalized === "canceled" ||
    normalized === "expired" ||
    normalized === "error" ||
    normalized === "rejected" ||
    normalized === "declined" ||
    normalized === "failure"
  );
};
