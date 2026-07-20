class Avo::Filters::ArticleStatusFilter < Avo::Filters::SelectFilter
  self.name = "Status"

  def apply(request, query, value)
    return query if value.blank?
    query.where(status: value)
  end

  def options
    ::Article.statuses.keys.index_with { |k| k.humanize }
  end
end
