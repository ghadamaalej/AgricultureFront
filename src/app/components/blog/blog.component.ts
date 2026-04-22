import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-blog',
  standalone: false,
  templateUrl: './blog.component.html',
  styleUrls: ['./blog.component.css']
})
export class BlogComponent {

  posts = [
    {
      id: 1,
      image: 'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=600&auto=format&fit=crop',
      category: 'Smart Farming',
      date: 'March 10, 2026',
      title: 'How Smart Farming Technologies Are Revolutionizing Agriculture in 2025',
      excerpt: 'From AI-powered crop monitoring to IoT soil sensors, discover how precision agriculture is helping farmers grow more with fewer resources.',
      author: 'AgTech Breakthrough',
      readTime: '6 min read',
      source: 'agtechbreakthrough.com',
      sourceUrl: 'https://agtechbreakthrough.com',
      body: `
        <p>Agriculture is undergoing one of the most dramatic transformations in its history. Across the globe, farmers are adopting smart technologies that were once available only to large industrial operations — and the results are remarkable.</p>

        <h2>The Rise of Precision Agriculture</h2>
        <p>Progressive technologies merging artificial intelligence (AI) with the Internet of Things (IoT) and big data analytics have launched a new era of modern precision agriculture. Current farming operations now benefit from drone technology combined with satellite imagery and soil-monitoring sensors to assess crop health, maximize resource efficiency, and improve yield forecasting.</p>
        <p>According to recent data, <strong>61% of North American farmers</strong> now use digital agronomy tools, a figure that has grown dramatically over the past five years.</p>

        <h2>AI and Automation Changing the Field</h2>
        <p>The fast adoption of automation and robotics in agriculture results from both a shortage of labor force and a need for improved agricultural efficiency. Modern farms have adopted autonomous machinery — including self-driving tractors and robotic harvesters — as their primary operational tools.</p>
        <p>AI-driven platforms are now integral for identifying diseases, forecasting yields, and optimizing irrigation cycles. Machine learning algorithms process data from multiple sources — satellite imagery, weather stations, and on-field sensors — to give farmers real-time, actionable guidance.</p>

        <h2>Making Technology Accessible to All Farmers</h2>
        <p>One of the most important trends is the Agri-TaaS (Technology as a Service) model, through which farmers can access advanced technologies by paying subscription or usage fees. This makes precision farming tools readily accessible to small and medium-sized farms without large upfront investments. The Agri-TaaS market worldwide is projected to exceed <strong>$3 billion by 2025</strong>.</p>

        <h2>What's Next for Smart Agriculture</h2>
        <p>By 2050, food production must increase by 60% to feed a global population of 9.3 billion. Smart farming technologies — from precision sensors to AI advisory platforms — are not a luxury; they are a necessity. Platforms that connect farmers with real-time data, market prices, logistics networks, and expert advice are becoming the backbone of modern agriculture.</p>
      `
    },
    {
      id: 2,
      image: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?w=600&auto=format&fit=crop',
      category: 'Digital Marketplace',
      date: 'March 5, 2026',
      title: 'How Digital Marketplaces Are Empowering Small Farmers to Reach Global Markets',
      excerpt: 'Digital platforms are breaking down barriers for smallholder farmers, enabling them to sell directly to buyers and access better prices.',
      author: 'Farming First',
      readTime: '5 min read',
      source: 'farmingfirst.org',
      sourceUrl: 'https://farmingfirst.org',
      body: `
        <p>For generations, small-scale farmers have faced an uphill battle when trying to sell their produce. That is rapidly changing thanks to digital marketplaces.</p>

        <h2>The Digital Shift in Farm-to-Market Trade</h2>
        <p>Digital marketplaces and e-commerce platforms have emerged as transformative solutions for addressing the long-standing challenges faced by agricultural producers in accessing fair and efficient markets. By leveraging mobile connectivity, cloud infrastructure, and real-time data systems, these platforms empower farmers to bypass traditional intermediaries.</p>

        <h2>Eliminating the Middleman</h2>
        <p>One of the biggest challenges faced by farmers has always been accessing reliable markets. Digital agritech platforms include built-in marketplaces where farmers can directly connect with buyers, suppliers, and retailers. Research highlights that export-oriented farmers earn <strong>20–50% higher incomes</strong> compared to those reliant solely on local markets.</p>
        <ul>
          <li>A pasture-based livestock farm increased direct-to-consumer sales by <strong>40%</strong> after integrating an online storefront.</li>
          <li>A diversified vegetable farm transitioned to a hybrid model — half of their sales now come from online pre-orders.</li>
          <li>A family dairy farm expanded its customer base by shipping artisanal cheeses directly to consumers.</li>
        </ul>

        <h2>Technology Bridging the Consumer Gap</h2>
        <p>Consumer interest in local food is at an all-time high. Surveys indicate that <strong>more than 55% of consumers</strong> express a preference for purchasing from local farms. By making farm-to-table transactions as seamless as ordering from a grocery app, digital platforms can bridge the gap between consumer demand and farm viability.</p>
      `
    },
    {
      id: 3,
      image: 'https://images.unsplash.com/photo-1464226184884-fa280b87c399?w=600&auto=format&fit=crop',
      category: 'AgTech Platforms',
      date: 'Feb 28, 2026',
      title: 'The Rising Wave of AgTech Platforms: Connecting Farmers, Buyers & Experts',
      excerpt: 'Agritech platforms are full ecosystems connecting every actor in the agricultural value chain, from soil sensor data to real-time market pricing.',
      author: 'Global AgTech Initiative',
      readTime: '7 min read',
      source: 'globalagtechinitiative.com',
      sourceUrl: 'https://www.globalagtechinitiative.com',
      body: `
        <p>Agriculture, one of the oldest industries in the world, is undergoing a digital transformation unlike anything seen before. The introduction of Agritech platforms has made it possible to merge cutting-edge technology with traditional farming practices.</p>

        <h2>A Growing Market</h2>
        <p>The global agritech platform market is projected to reach <strong>US$16.9 billion by 2025</strong> and grow at a robust CAGR of 14.2%, hitting US$42.8 billion by 2032. Fueled by the integration of AI, IoT, and machine learning, agritech platforms are revolutionizing how farmers approach crop management, resource efficiency, and market access.</p>

        <h2>What Modern AgTech Platforms Offer</h2>
        <ul>
          <li><strong>Precision farming tools</strong> — IoT sensors and satellite data for real-time crop monitoring</li>
          <li><strong>Digital marketplaces</strong> — Direct buyer-seller connections that eliminate intermediaries</li>
          <li><strong>Supply chain management</strong> — Real-time tracking from farm to consumer</li>
          <li><strong>Expert advisory</strong> — Access to certified agronomists, veterinarians, and specialists</li>
          <li><strong>Financial services</strong> — Microfinancing, crop insurance, and secure digital payments</li>
        </ul>

        <h2>The Impact on Farmers' Livelihoods</h2>
        <p>The adoption of Agritech platforms has brought measurable benefits. CropIn, an AI-powered farm solution, combines predictive analytics with IoT integrations. Farmers using this system have achieved a <strong>10–30% increase in productivity and income</strong>.</p>

        <h2>The Road Ahead</h2>
        <p>The future of agriculture is connected, data-driven, and inclusive. As platforms continue to evolve — integrating blockchain traceability, carbon footprint tracking, and AI-powered logistics — every actor in the agricultural ecosystem stands to benefit.</p>
      `
    }
  ];

  constructor(private router: Router) {}

  goToDetail(post: any): void {
    localStorage.setItem('selectedPost', JSON.stringify(post));
    this.router.navigate(['/blog', post.id]);  
  }
}