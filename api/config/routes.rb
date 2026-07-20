Rails.application.routes.draw do
  mount_avo
  devise_for :admin_users
  # Define your application routes per the DSL in https://guides.rubyonrails.org/routing.html

  # Reveal health status on /up that returns 200 if the app boots with no exceptions, otherwise 500.
  # Can be used by load balancers and uptime monitors to verify that the app is live.
  get "up" => "rails/health#show", as: :rails_health_check

  namespace :api do
    namespace :v1 do
      # Articles are addressed by slug (the whole /%postname%/ path).
      resources :articles, only: [:index, :show], param: :slug do
        post :view, on: :member
      end
      resources :categories, only: [:index, :show], param: :slug
      resources :authors, only: [:show], param: :slug
      resources :tags, only: [:show], param: :slug

      # Directory — /directory hub, /directory/{type}, /directory/{type}/{id}.
      get "directory", to: "directory#index"
      get "directory/:type", to: "directory#type"
      get "directory/:type/:id", to: "directory#show"

      # Public article search.
      get "search", to: "search#index"

      # Free registration-wall signup.
      post "subscribe", to: "subscriptions#create"

      # Ads — public delivery + impression/click tracking.
      get "ads", to: "ads#index"
      get "ads/:id/click", to: "ads#click"
      post "ads/:id/impression", to: "ads#impression"

      get "redirects/resolve", to: "redirects#resolve"
      resources :missed_paths, only: [:create]

      # SEO — served at the public domain via Next.js rewrites.
      get "sitemap", to: "sitemaps#index"
      get "sitemap/articles/:page", to: "sitemaps#articles"
      get "sitemap/news", to: "sitemaps#news"
      get "sitemap/archives", to: "sitemaps#archives"
      get "feed", to: "sitemaps#feed"

      namespace :admin do
        get "stats", to: "stats#show"
        resources :articles, only: [:index, :show, :create, :update]
        resources :authors, only: [:index, :update]
        resources :categories, only: [:index]
        resources :directory_listings, only: [:index, :show, :create, :update, :destroy] do
          post :import, on: :collection
        end
        resources :ads, only: [:index, :show, :create, :update, :destroy]
      end
    end
  end
end
