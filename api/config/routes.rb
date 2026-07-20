Rails.application.routes.draw do
  # Define your application routes per the DSL in https://guides.rubyonrails.org/routing.html

  # Reveal health status on /up that returns 200 if the app boots with no exceptions, otherwise 500.
  # Can be used by load balancers and uptime monitors to verify that the app is live.
  get "up" => "rails/health#show", as: :rails_health_check

  namespace :api do
    namespace :v1 do
      # Articles are addressed by slug (the whole /%postname%/ path).
      resources :articles, only: [:index, :show], param: :slug
      resources :categories, only: [:index, :show], param: :slug
      resources :authors, only: [:show], param: :slug
      resources :tags, only: [:show], param: :slug

      get "redirects/resolve", to: "redirects#resolve"
      resources :missed_paths, only: [:create]

      # SEO — served at the public domain via Next.js rewrites.
      get "sitemap", to: "sitemaps#index"
      get "sitemap/articles/:page", to: "sitemaps#articles"
      get "sitemap/news", to: "sitemaps#news"
      get "sitemap/archives", to: "sitemaps#archives"
      get "feed", to: "sitemaps#feed"

      namespace :admin do
        resources :articles, only: [:index, :show, :update]
        resources :authors, only: [:index, :update]
        resources :categories, only: [:index]
      end
    end
  end
end
