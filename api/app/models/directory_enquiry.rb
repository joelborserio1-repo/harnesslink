# frozen_string_literal: true

# A "contact this listing" enquiry captured from a directory profile.
class DirectoryEnquiry < ApplicationRecord
  belongs_to :directory_listing, optional: true

  validates :name, presence: true
  validates :email, presence: true
  enum :status, { new: "new", read: "read", archived: "archived" }, default: "new", prefix: true
end
