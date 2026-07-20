# frozen_string_literal: true

class ArticleAuthor < ApplicationRecord
  belongs_to :article
  belongs_to :author

  validates :author_id, uniqueness: { scope: :article_id }
end
