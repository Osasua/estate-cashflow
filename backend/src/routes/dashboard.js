// 1. KPIs - Include estate opening balance
const kpisRes = await query(`
  SELECT 
    -- Cash Balance: Estate opening balance + all contributions - all expenses
    COALESCE((SELECT opening_balance FROM estate_opening_balance WHERE id = 1), 0) +
    COALESCE((SELECT SUM(amount_paid) FROM contributions), 0) -
    COALESCE((SELECT SUM(amount) FROM expenses), 0) AS balance,
    
    -- This Month Collected
    COALESCE((
      SELECT SUM(amount_paid) 
      FROM contributions 
      WHERE period_year = $1 AND period_month = $2
    ), 0) AS month_in,
    
    -- This Month Expected
    COALESCE((
      SELECT SUM(monthly_due) 
      FROM members 
      WHERE active = true
    ), 0) AS month_due,
    
    -- This Month Expenses
    COALESCE((
      SELECT SUM(amount) 
      FROM expenses 
      WHERE EXTRACT(YEAR FROM spent_on) = $1 
        AND EXTRACT(MONTH FROM spent_on) = $2
    ), 0) AS month_expense,
    
    -- Households Owing
    COALESCE((
      SELECT COUNT(DISTINCT member_id)
      FROM contributions
      WHERE period_year = $1 
        AND period_month = $2 
        AND type = 'monthly' 
        AND amount_paid < amount_due
    ), 0)::int AS pending_count
`, [currentYear, currentMonth]);