export const calculateUsageAndStatus = (quantity, threshold) => {
  if (!threshold || threshold <= 0) {
    return { usagePercent: 0, status: "Sufficient" };
  }

  let usage = ((threshold - quantity) / threshold) * 100;
  usage = Math.min(Math.max(usage, 0), 100);
  const usagePercent = Math.round(usage);

  let status = "Sufficient"; 

  if (usagePercent >= 75) status = "Low Stock";
  else if (usagePercent >= 50) status = "Moderate";
  else status = "Sufficient";

  return { usagePercent, status };
};
