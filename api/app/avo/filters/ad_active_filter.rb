class Avo::Filters::AdActiveFilter < Avo::Filters::BooleanFilter
  self.name = "Status"

  def apply(request, query, values)
    if values["active"] && !values["paused"]
      query.where(is_active: true)
    elsif values["paused"] && !values["active"]
      query.where(is_active: false)
    else
      query
    end
  end

  def options
    { active: "Active", paused: "Paused" }
  end
end
