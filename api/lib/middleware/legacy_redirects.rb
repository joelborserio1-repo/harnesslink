# frozen_string_literal: true

# Rack middleware: 301 legacy paths to their new location and count the hit.
# The public site (Next.js) enforces redirects at the edge; this is the
# defensive backstop for anything that reaches the Rails host directly.
class LegacyRedirects
  SKIP_PREFIXES = ["/api", "/up", "/rails", "/assets", "/cable"].freeze

  def initialize(app)
    @app = app
  end

  def call(env)
    request = Rack::Request.new(env)

    if (request.get? || request.head?) && !skip?(request.path)
      redirect = Redirect.resolve(request.path)
      if redirect
        redirect.record_hit!
        location = redirect.to_path
        return [
          redirect.status_code,
          { "Location" => location, "Content-Type" => "text/html", "Cache-Control" => "no-store" },
          ["Redirecting to #{location}"]
        ]
      end
    end

    @app.call(env)
  end

  private

  def skip?(path)
    SKIP_PREFIXES.any? { |prefix| path.start_with?(prefix) }
  end
end
