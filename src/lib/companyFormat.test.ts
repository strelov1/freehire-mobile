import { companyFacts, companyRating } from './format';
import type { Company } from './types';

const baseCompany: Company = {
  slug: 'acme',
  name: 'Acme',
  upvote_count: 0,
  downvote_count: 0,
  feedback_count: 0,
  feedback_rating_avg: null,
};

describe('companyFacts', () => {
  it('returns no facts for a bare company', () => {
    expect(companyFacts(baseCompany)).toEqual([]);
  });

  it('includes industries as a multi-value fact', () => {
    const company: Company = { ...baseCompany, industries: ['Fintech', 'SaaS'] };
    expect(companyFacts(company)).toEqual([{ label: 'Industries', values: ['Fintech', 'SaaS'] }]);
  });

  it('includes founded/employees/HQ/type as single-value facts, in order', () => {
    const company: Company = {
      ...baseCompany,
      year_founded: 2015,
      employee_count: 50,
      hq_country: 'US',
      organization_type: 'Private',
    };
    expect(companyFacts(company)).toEqual([
      { label: 'Founded', values: ['2015'] },
      { label: 'Employees', values: ['50'] },
      { label: 'HQ', values: ['US'] },
      { label: 'Type', values: ['Private'] },
    ]);
  });

  it('formats funding with type and amount', () => {
    const company: Company = {
      ...baseCompany,
      company_info: { funding: { type: 'Series A', amount: 5_000_000 } },
    };
    expect(companyFacts(company)).toEqual([
      { label: 'Funding', values: ['Series A', '$5,000,000'] },
    ]);
  });

  it('formats funding with only a type', () => {
    const company: Company = { ...baseCompany, company_info: { funding: { type: 'Seed' } } };
    expect(companyFacts(company)).toEqual([{ label: 'Funding', values: ['Seed'] }]);
  });

  it('formats stock with symbol and exchange', () => {
    const company: Company = {
      ...baseCompany,
      company_info: { stock: { symbol: 'ACME', exchange: 'NASDAQ' } },
    };
    expect(companyFacts(company)).toEqual([{ label: 'Stock', values: ['ACME', 'NASDAQ'] }]);
  });

  it('omits stock when there is no symbol', () => {
    const company: Company = { ...baseCompany, company_info: { stock: { exchange: 'NASDAQ' } } };
    expect(companyFacts(company)).toEqual([]);
  });
});

describe('companyRating', () => {
  it('returns null when there is no feedback yet', () => {
    expect(companyRating(baseCompany)).toBeNull();
  });

  it('formats the average and count, pluralizing "reviews"', () => {
    const company: Company = { ...baseCompany, feedback_count: 12, feedback_rating_avg: 4.5 };
    expect(companyRating(company)).toBe('4.5 (12 reviews)');
  });

  it('keeps "review" singular for exactly one', () => {
    const company: Company = { ...baseCompany, feedback_count: 1, feedback_rating_avg: 5 };
    expect(companyRating(company)).toBe('5.0 (1 review)');
  });
});
