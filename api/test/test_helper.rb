ENV["RAILS_ENV"] ||= "test"
require_relative "../config/environment"
require "rails/test_help"

module ActiveSupport
  class TestCase
    # Run tests in parallel with specified workers
    parallelize(workers: :number_of_processors)

    # Setup all fixtures in test/fixtures/*.yml for all tests in alphabetical order.
    fixtures :all

    # Bearer header for the editorial portal API, signed in as the given user.
    def staff_headers(user = users(:admin))
      { "Authorization" => "Bearer #{user.generate_token_for(:staff_session)}" }
    end
  end
end
