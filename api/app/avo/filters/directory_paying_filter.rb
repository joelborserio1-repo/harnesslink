class Avo::Filters::DirectoryPayingFilter < Avo::Filters::BooleanFilter
  self.name = "Tier"

  def apply(request, query, values)
    if values["paid"] && !values["free"]
      query.where(is_paying: true)
    elsif values["free"] && !values["paid"]
      query.where(is_paying: false)
    else
      query
    end
  end

  def options
    { paid: "Paid", free: "Free" }
  end
end
