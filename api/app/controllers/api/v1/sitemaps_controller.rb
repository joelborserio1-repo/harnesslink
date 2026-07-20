# frozen_string_literal: true

module Api
  module V1
    class SitemapsController < ApplicationController
      def index
        xml Sitemaps::Builder.index_xml
      end

      def articles
        xml Sitemaps::Builder.articles_xml(params[:page])
      end

      def news
        xml Sitemaps::Builder.news_xml
      end

      def feed
        xml Sitemaps::Builder.feed_xml
      end

      private

      def xml(body)
        render body: body, content_type: "application/xml"
      end
    end
  end
end
