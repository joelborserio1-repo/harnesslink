# frozen_string_literal: true

# A progeny (offspring) row shown on a stallion's directory profile.
class DirectoryProgeny < ApplicationRecord
  self.table_name = "directory_progeny"
  belongs_to :directory_listing
end
