class Avo::Filters::DirectoryTypeFilter < Avo::Filters::SelectFilter
  self.name = "Type"

  def apply(request, query, value)
    return query if value.blank?
    query.where(directory_type: value)
  end

  def options
    Directory::TypeRegistry.all.to_h { |t| [t[:key], t[:singular]] }
  end
end
