const THINK_TAGS = [
  "5-Star Reviews",
  "Logo Design",
  "Website Aesthetics",
  "Social Media Followers",
  "Instagram Posts",
  "TikTok Videos",
  "Google Ads",
  "Business Cards",
  "Founder Photo",
  "Company Slogan",
  "Testimonials",
  "Awards & Badges",
  "Blog Posts",
  "Email Newsletter",
  "YouTube Channel",
  "Press Releases",
  "Font Choice",
  "Color Palette",
  "Page Load Speed",
  "Ad Spend",
  "Stock Photography",
  "Follower Count",
];

const EVALUATE_TAGS = [
  "Identity Clarity",
  "Location & Service Area",
  "Structured Data / Schema",
  "Review Authority",
  "Content Freshness",
  "NAP Consistency",
  "Knowledge Depth",
  "Machine Readability",
];

export default function IcebergComparison() {
  return (
    <div className="iceberg-wrap">
      <div>
        <div className="iceberg__label">What Businesses Think Matters</div>
        <div className="iceberg iceberg--small">
          <div className="iceberg__tip iceberg__tip--small" />
          <div className="iceberg__waterline iceberg__waterline--small" />
          <div className="iceberg__body iceberg__body--left">
            <div className="iceberg__depth" />
            <div className="iceberg__tags">
              {THINK_TAGS.map((t) => (
                <span key={t} className="iceberg__tag iceberg__tag--small">
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div>
        <div className="iceberg__label">What AI Actually Evaluates</div>
        <div className="iceberg iceberg--tall">
          <div className="iceberg__tip iceberg__tip--tall" />
          <div className="iceberg__waterline iceberg__waterline--tall" />
          <div className="iceberg__body iceberg__body--right">
            <div className="iceberg__depth" />
            <div className="iceberg__tags">
              {EVALUATE_TAGS.map((t) => (
                <span key={t} className="iceberg__tag iceberg__tag--large">
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
