# human_body_simulation

A prototype simulation of the human body as a multi-agent system, where each major body system (nervous, circulatory, respiratory, digestive, endocrine, musculoskeletal, immune, excretory, and brain) is represented as an interconnected program. The simulation visualizes interactions and homeostasis in real time.

## Features

- Interactive web-based prototype ([prototype](prototype)) visualizing body systems and their states
- Simulates stress response, digestion, rest, and recovery
- Models physiological variables (heart rate, breathing rate, hormone levels, etc.)
- Modular structure for each system with real-time updates

## Getting Started

### Prerequisites

- A modern web browser (Chrome, Firefox, Edge, Safari)
- (Optional) [Docker](https://www.docker.com/) and [Google Cloud](https://cloud.google.com/) account for deployment

### Running the Prototype Locally

1. Open the [prototype](prototype) file in your browser to view and interact with the simulation.

### Project Structure

- [`prototype`](prototype): Main HTML/JS/CSS file for the simulation UI and logic
- [README.md](README.md): Project overview and instructions
- [.github/workflows/google.yml](.github/workflows/google.yml): GitHub Actions workflow for building and deploying to Google Kubernetes Engine (GKE)

### Deployment

This project includes a GitHub Actions workflow ([.github/workflows/google.yml](.github/workflows/google.yml)) for building a Docker container and deploying to Google Kubernetes Engine. See comments in the workflow file for setup instructions.

## Usage

- **Detect Threat (Fight-or-Flight):** Simulates a stress response across all systems
- **Ingest Food:** Triggers digestion and nutrient absorption
- **Rest & Recover:** Returns the system to a resting state

Observe how each system responds to different scenarios in real time.

## Contributing

Pull requests and suggestions are welcome! Please open an issue to discuss changes or ideas.

## License

[MIT](LICENSE)
