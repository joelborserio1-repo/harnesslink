class Avo::Filters::ArticleNeedsReviewFilter < Avo::Filters::BooleanFilter
  self.name = "Needs review"

  def apply(request, query, values)
    return query unless values["needs_review"]
    query.where(needs_review: true)
  end

  def options
    { needs_review: "Flagged for review" }
  end
end
