# frozen_string_literal: true

# Editorial revision history for articles authored/edited in our CMS.
# (WordPress's 41k legacy revisions are intentionally NOT migrated.)
class ArticleRevision < ApplicationRecord
  enum :body_format, { legacy_html: 0, tiptap_json: 1 }, prefix: true

  belongs_to :article
  belongs_to :editor, class_name: "User", optional: true

  validates :title, presence: true
end
