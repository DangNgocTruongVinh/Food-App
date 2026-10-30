import { Leaf, UsersRound } from "lucide-react";

export default function CommunityHero() {
  return <header className="community-hero">
    <div className="community-hero-copy">
      <span className="community-kicker"><UsersRound /> Cộng đồng NOURI</span>
      <h1><span>Cùng nhau</span> ăn ngon, sống khỏe</h1>
      <p>Chia sẻ bữa ăn, mẹo dinh dưỡng và những thay đổi nhỏ giúp hành trình lành mạnh trở nên vui hơn mỗi ngày.</p>
    </div>
    <div className="community-hero-art" aria-hidden="true">
      <span className="community-hero-glow" />
      <img src="/assets/recipe-vegan-bowl.jpg" alt="" />
      <Leaf className="hero-leaf hero-leaf-one" />
      <Leaf className="hero-leaf hero-leaf-two" />
      <Leaf className="hero-leaf hero-leaf-three" />
    </div>
  </header>;
}
