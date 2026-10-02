# frozen_string_literal: true

module Api
  module V1
    module Admin
      class ArticlesController < BaseController
        # GET /api/v1/admin/articles?status=&needs_review=&q=&page=
        def index
          page     = [ params.fetch(:page, 1).to_i, 1 ].max
          per_page = [ [ params.fetch(:per_page, 25).to_i, 1 ].max, 100 ].min

          scope = visible_articles.includes(:primary_category, :created_by, article_authors: :author)
                                  .order(created_at: :desc)
          scope = scope.where(created_by_id: current_user.id) if params[:mine] == "true"
          scope = scope.where(status: Article.statuses[params[:status]]) if params[:status].present?
          scope = scope.where(needs_review: true) if params[:needs_review] == "true"
          if params[:q].present?
            scope = scope.where("title ILIKE ?", "%#{ActiveRecord::Base.sanitize_sql_like(params[:q])}%")
          end

          render json: {
            articles: scope.offset((page - 1) * per_page).limit(per_page).map { |a| AdminArticleSerializer.summary(a) },
            page: page, per_page: per_page, total: scope.count
          }
        end

        # GET /api/v1/admin/articles/:id
        def show
          render json: { article: AdminArticleSerializer.full(find_article) }
        end

        # POST /api/v1/admin/articles — author a new article (TipTap editor).
        def create
          article = Article.new(article_params)
          article.legacy_source ||= "editorial"
          article.created_by = current_user
          apply_associations(article)
          # A journalist's own story carries their byline unless one was chosen.
          if article.article_authors.empty? && current_user.author_id
            article.article_authors.build(author_id: current_user.author_id, position: 0)
          end
          stamp_publication(article)

          if article.save
            render json: { article: AdminArticleSerializer.full(article.reload) }, status: :created
          else
            render json: { errors: article.errors.full_messages }, status: :unprocessable_entity
          end
        end

        # PATCH /api/v1/admin/articles/:id
        def update
          article = find_article
          return forbid! unless editable_by_current_user?(article)

          revision = snapshot(article)
          article.assign_attributes(article_params)
          apply_associations(article)
          stamp_publication(article)

          if article.save
            revision.save if revision_worthy?(article)
            render json: { article: AdminArticleSerializer.full(article.reload) }
          else
            render json: { errors: article.errors.full_messages }, status: :unprocessable_entity
          end
        end

        private

        # Editors and admins see everything; a contributor only their own stories.
        def visible_articles
          current_user.can_publish? ? Article.all : Article.where(created_by_id: current_user.id)
        end

        def find_article
          visible_articles.find(params[:id])
        end

        # A contributor can keep working on a story until it leaves their hands
        # (draft or awaiting review). Once published it is the desk's.
        def editable_by_current_user?(article)
          current_user.can_publish? || article.status_draft? || article.status_in_review?
        end

        # Going live needs a publish time; the public scope filters on it.
        def stamp_publication(article)
          article.published_at ||= Time.current if article.status_published?
        end

        # The state before this save, kept so an edit can be undone.
        def snapshot(article)
          article.article_revisions.build(
            title: article.title_was, subtitle: article.subtitle_was,
            body_format: article.body_format_was, body_html: article.body_html_was,
            body_json: article.body_json_was || {}, editor: current_user
          )
        end

        def revision_worthy?(article)
          (article.previous_changes.keys & %w[title subtitle body_html body_json]).any?
        end

        def article_params
          permitted = params.require(:article).permit(
            :title, :subtitle, :slug, :excerpt, :status, :body_format, :body_html,
            :seo_title, :seo_description, :focus_keyword, :canonical_url, :robots,
            :og_title, :og_description, :twitter_title, :twitter_description,
            :schema_type, :primary_category_id, :needs_review, :published_at
          )
          # Contributors file and submit; only the desk publishes, schedules or archives.
          unless current_user.can_publish?
            permitted.delete(:status) unless %w[draft in_review].include?(permitted[:status].to_s)
            permitted.delete(:published_at)
            permitted.delete(:needs_review)
          end
          # TipTap sends body_json as a JSON string; store it as a hash.
          if params[:article].key?(:body_json)
            raw = params[:article][:body_json]
            permitted[:body_json] = raw.is_a?(String) ? (JSON.parse(raw) rescue {}) : raw
          end
          permitted
        end

        # Rebuild byline order from author_ids; set category/tag membership.
        def apply_associations(article)
          if params[:article].key?(:author_ids)
            article.article_authors.destroy_all
            Array(params[:article][:author_ids]).each_with_index do |aid, i|
              article.article_authors.build(author_id: aid, position: i)
            end
          end
          article.category_ids = Array(params[:article][:category_ids]) if params[:article].key?(:category_ids)
          article.tag_ids = Array(params[:article][:tag_ids]) if params[:article].key?(:tag_ids)
        end
      end
    end
  end
end
