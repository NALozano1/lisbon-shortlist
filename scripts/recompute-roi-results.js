#!/usr/bin/env node
/**
 * Recompute roi-results.json with bank quote mortgage formula
 * Bank quote: €690/month on €190,000 loan — scales linearly
 */

const fs = require('fs');
const path = require('path');

const BANK_QUOTE_LOAN_EUR = 190000;
const BANK_QUOTE_PAYMENT_EUR = 690;

function bankQuoteMonthly(loanEur) {
  const loan = Number(loanEur) || 0;
  if (loan <= 0) return 0;
  return BANK_QUOTE_PAYMENT_EUR * (loan / BANK_QUOTE_LOAN_EUR);
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function coverageFlag(ratio) {
  if (ratio >= 1.25) return 'comfortable';
  if (ratio >= 1.0) return 'tight';
  return 'below';
}

function recomputePath(pathObj, mortgageMonthly) {
  if (!pathObj || pathObj.income_monthly == null) return pathObj;
  
  const incomeMonthly = pathObj.income_monthly;
  const coverageRatio = mortgageMonthly > 0 ? round2(incomeMonthly / mortgageMonthly) : null;
  const flag = coverageRatio != null ? coverageFlag(coverageRatio) : null;
  
  const noiMonthly = pathObj.noi / 12;
  const leftAfterMortgage = noiMonthly - mortgageMonthly;
  const mortgageAnnual = mortgageMonthly * 12;
  const cashFlow = pathObj.noi - mortgageAnnual;
  
  return {
    ...pathObj,
    mortgage_monthly_40y: round2(mortgageMonthly),
    coverage_ratio: coverageRatio,
    coverage_flag: flag,
    cf: round2(cashFlow)
  };
}

function main() {
  const dataDir = path.join(__dirname, '..', 'data');
  const resultsPath = path.join(dataDir, 'roi-results.json');
  
  const data = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
  
  console.log('Bank quote mortgage formula:');
  console.log(`  €${BANK_QUOTE_PAYMENT_EUR}/mo on €${BANK_QUOTE_LOAN_EUR.toLocaleString()} loan`);
  console.log(`  Scales linearly: payment = ${BANK_QUOTE_PAYMENT_EUR} × (loan / ${BANK_QUOTE_LOAN_EUR})`);
  console.log('');
  
  // Track one listing for before/after comparison
  let beforeAfterExample = null;
  
  for (const r of data.results) {
    const loanEur = r.loan_eur;
    const newMortgageMonthly = round2(bankQuoteMonthly(loanEur));
    const oldMortgageMonthly = r.mortgage_monthly_eur;
    
    // Store before/after for #12 Martim Moniz
    if (r.listing_rank === 12) {
      beforeAfterExample = {
        title: r.title,
        loan_eur: loanEur,
        old_mortgage_monthly: oldMortgageMonthly,
        new_mortgage_monthly: newMortgageMonthly,
        old_str_mid_coverage: r.str_mid?.coverage_ratio,
        old_str_mid_flag: r.str_mid?.coverage_flag,
        old_ltr_coverage: r.ltr?.coverage_ratio,
        old_ltr_flag: r.ltr?.coverage_flag
      };
    }
    
    // Update top-level mortgage field
    r.mortgage_monthly_eur = newMortgageMonthly;
    
    // Recompute all income paths
    r.str_cons = recomputePath(r.str_cons, newMortgageMonthly);
    r.str_mid = recomputePath(r.str_mid, newMortgageMonthly);
    r.ltr = recomputePath(r.ltr, newMortgageMonthly);
    
    // Update after values for example
    if (r.listing_rank === 12) {
      beforeAfterExample.new_str_mid_coverage = r.str_mid?.coverage_ratio;
      beforeAfterExample.new_str_mid_flag = r.str_mid?.coverage_flag;
      beforeAfterExample.new_ltr_coverage = r.ltr?.coverage_ratio;
      beforeAfterExample.new_ltr_flag = r.ltr?.coverage_flag;
    }
  }
  
  // Update metadata
  data.model_version = '0.1.7';
  data.generated_at = new Date().toISOString();
  data.method_note = `Batch mirrors live roi.js compute + data/roi-model.json defaults (0.1.7; bank quote €${BANK_QUOTE_PAYMENT_EUR}/mo on €${BANK_QUOTE_LOAN_EUR.toLocaleString()} scaled linearly). Property-level AirDNA Rentalizer was NOT available — validation is parish/city comps (AirDNA Lisbon TTM thru Jul 2026: ~65% occ / $147 ADR / ~$23.1k avg; BNBCalc size ladder × GuestFavorites parish multipliers; Idealista LTR asking mids 2026-09-24). No bank personal details. Pre-IRS / pre-AL-tax; IMT illustrative Tabela III secondary proxy. STR path on AL=false listings assumes licence obtainable/already licensed — regulatory risk.`;
  
  // Write updated results
  fs.writeFileSync(resultsPath, JSON.stringify(data, null, 2) + '\n');
  
  console.log(`Updated ${data.results.length} listings in ${resultsPath}`);
  console.log('');
  
  // Print before/after example
  if (beforeAfterExample) {
    console.log('=== BEFORE/AFTER EXAMPLE: #12 Martim Moniz ===');
    console.log(`Title: ${beforeAfterExample.title}`);
    console.log(`Loan: €${beforeAfterExample.loan_eur.toLocaleString()}`);
    console.log('');
    console.log('Mortgage payment:');
    console.log(`  Before (4%/40y amort): €${beforeAfterExample.old_mortgage_monthly}/mo`);
    console.log(`  After (bank quote):    €${beforeAfterExample.new_mortgage_monthly}/mo`);
    console.log('');
    console.log('STR mid coverage:');
    console.log(`  Before: ${beforeAfterExample.old_str_mid_coverage}× (${beforeAfterExample.old_str_mid_flag})`);
    console.log(`  After:  ${beforeAfterExample.new_str_mid_coverage}× (${beforeAfterExample.new_str_mid_flag})`);
    console.log('');
    console.log('LTR coverage:');
    console.log(`  Before: ${beforeAfterExample.old_ltr_coverage}× (${beforeAfterExample.old_ltr_flag})`);
    console.log(`  After:  ${beforeAfterExample.new_ltr_coverage}× (${beforeAfterExample.new_ltr_flag})`);
  }
  
  // Verify specific test cases
  console.log('');
  console.log('=== VERIFICATION ===');
  console.log(`€190,000 loan → €${round2(bankQuoteMonthly(190000))}/mo (expected: €690)`);
  console.log(`€95,000 loan  → €${round2(bankQuoteMonthly(95000))}/mo (expected: €345)`);
}

main();
